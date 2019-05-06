import { IHttpMethod } from '@stoplight/prism-http';
import { Chance } from 'chance';
import defaults = require('lodash/defaults');

const chance = new Chance();
const httpMethods: IHttpMethod[] = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
];

export function pickOneHttpMethod(): IHttpMethod {
  return chance.pickone(httpMethods);
}

export function pickSetOfHttpMethods(count: number = 2): IHttpMethod[] {
  return chance.unique(pickOneHttpMethod, count);
}

export function randomArray<T>(itemGenerator: () => T, length: number = 1): T[] {
  return new Array(length).fill(null).map(itemGenerator);
}

const defaultRandomPathOptions = {
  pathFragments: 3,
  includeTemplates: true,
  leadingSlash: true,
};

interface IRandomPathOptions {
  pathFragments?: number;
  includeTemplates?: boolean;
  trailingSlash?: boolean;
  leadingSlash?: boolean;
}

export function randomPath(opts: IRandomPathOptions = defaultRandomPathOptions): string {
  const optsWithDefaults = defaults({}, opts, defaultRandomPathOptions);

  const randomPathFragments = randomArray(
    () =>
      optsWithDefaults.includeTemplates && chance.bool() ? `{${chance.word()}}` : chance.word(),
    optsWithDefaults.pathFragments
  );

  const leadingSlash = optsWithDefaults.leadingSlash ? '/' : '';
  const trailingSlash = optsWithDefaults.trailingSlash ? '/' : '';

  return `${leadingSlash}${randomPathFragments.join('/')}${trailingSlash}`;
}
