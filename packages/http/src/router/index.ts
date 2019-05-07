import { IRouter } from '@stoplight/prism-core';
import { IHttpOperation, IServer } from '@stoplight/types';
import { ProblemJson } from 'http-server/src/types';
import { IHttpConfig, IHttpRequest } from '../types';
import {
  NO_METHOD_MATCHED_ERROR,
  NO_PATH_MATCHED_ERROR,
  NO_SERVER_CONFIGURATION_PROVIDED_ERROR,
  NO_SERVER_MATCHED_ERROR,
} from './errors';
import { matchBaseUrl } from './matchBaseUrl';
import { matchPath } from './matchPath';
import { IMatch, MatchType } from './types';

export const router: IRouter<IHttpOperation, IHttpRequest, IHttpConfig> = {
  route: ({ resources, input }): IHttpOperation => {
    const { path: requestPath, baseUrl: requestBaseUrl } = input.url;

    const matches = resources.map<IMatch>(resource => {
      const pathMatch = matchPath(requestPath, resource.path);
      if (pathMatch === MatchType.NOMATCH)
        return {
          pathMatch,
          methodMatch: MatchType.NOMATCH,
          resource,
        };

      const methodMatch = matchByMethod(input, resource) ? MatchType.CONCRETE : MatchType.NOMATCH;

      if (methodMatch === MatchType.NOMATCH) {
        return {
          pathMatch,
          methodMatch,
          resource,
        };
      }

      const { servers = [] } = resource;

      if (requestBaseUrl && servers.length > 0) {
        const serverMatch = matchServer(servers, requestBaseUrl);

        return {
          pathMatch,
          methodMatch,
          serverMatch,
          resource,
        };
      }

      return {
        pathMatch,
        methodMatch,
        serverMatch: null,
        resource,
      };
    });

    if (requestBaseUrl) {
      if (matches.every(match => match.serverMatch === null)) {
        throw new ProblemJson(
          NO_SERVER_CONFIGURATION_PROVIDED_ERROR.name,
          NO_SERVER_CONFIGURATION_PROVIDED_ERROR.title,
          NO_SERVER_CONFIGURATION_PROVIDED_ERROR.status,
          `No server configuration has been provided, although ${requestBaseUrl} as base url`);
      }

      if (matches.every(match => !!match.serverMatch && match.serverMatch === MatchType.NOMATCH)) {
        throw new ProblemJson(
          NO_SERVER_MATCHED_ERROR.name,
          NO_SERVER_MATCHED_ERROR.title,
          NO_SERVER_MATCHED_ERROR.status,
          `The base url ${requestBaseUrl} hasn't been matched with any of the provided servers`);
      }
    }

    if (!matches.some(match => match.pathMatch !== MatchType.NOMATCH)) {
      throw new ProblemJson(
        NO_PATH_MATCHED_ERROR.name,
        NO_PATH_MATCHED_ERROR.title,
        NO_PATH_MATCHED_ERROR.status,
        `The route ${requestPath} hasn't been found in the specification file`);
    }

    if (
      !matches.some(
        match => match.pathMatch !== MatchType.NOMATCH && match.methodMatch !== MatchType.NOMATCH
      )
    ) {
      throw new ProblemJson(
        NO_METHOD_MATCHED_ERROR.name,
        NO_METHOD_MATCHED_ERROR.title,
        NO_METHOD_MATCHED_ERROR.status,
        `The route ${requestPath} has been matched, but there's no "${input.method}" method defined`
      );
    }

    return disambiguateMatches(matches);
  },
};

function matchServer(servers: IServer[], requestBaseUrl: string) {
  const serverMatches = servers
    .map(server => matchBaseUrl(server, requestBaseUrl))
    .filter(match => match !== MatchType.NOMATCH);

  return disambiguateServers(serverMatches);
}

function matchByMethod(request: IHttpRequest, operation: IHttpOperation): boolean {
  return operation.method.toLowerCase() === request.method.toLowerCase();
}

function disambiguateMatches(matches: IMatch[]): IHttpOperation {
  const matchResult =
    // prefer concrete server and concrete path
    matches.find(match => areServerAndPath(match, MatchType.CONCRETE, MatchType.CONCRETE)) ||
    // then prefer templated server and concrete path
    matches.find(match => areServerAndPath(match, MatchType.TEMPLATED, MatchType.CONCRETE)) ||
    // then prefer concrete server and templated path
    matches.find(match => areServerAndPath(match, MatchType.CONCRETE, MatchType.TEMPLATED)) ||
    // then fallback to first
    matches[0];

  return matchResult.resource;
}

function areServerAndPath(match: IMatch, serverType: MatchType, pathType: MatchType) {
  const serverMatch = match.serverMatch;
  if (serverMatch === null) {
    // server match will only be null if server matching is disabled.
    // therefore skip comparison.
    return match.pathMatch === pathType;
  }
  return serverMatch === serverType && match.pathMatch === pathType;
}

/**
 * If a concrete server match exists then return first such match.
 * If no concrete server match exists return first (templated) match.
 */
function disambiguateServers(serverMatches: MatchType[]): MatchType {
  const concreteMatch = serverMatches.find(serverMatch => serverMatch === MatchType.CONCRETE);
  return concreteMatch || serverMatches[0] || MatchType.NOMATCH;
}
