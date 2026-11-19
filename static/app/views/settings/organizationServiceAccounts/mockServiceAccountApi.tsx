/**
 * In-memory stand-in for the service account endpoints, so the UI mock can be clicked
 * through end to end. Data resets on page reload.
 *
 * Pages only talk to the query options and mutation hooks below, so swapping them for
 * `apiOptions` and `fetchMutation` calls later doesn't touch the components.
 */
import {queryOptions, useMutation, useQueryClient} from '@tanstack/react-query';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {resolveBundle, type GuardrailId} from './serviceAccountData';
import type {
  NewServiceAccountToken,
  ServiceAccount,
  ServiceAccountInput,
  ServiceAccountToken,
  ServiceAccountTokenInput,
} from './types';

type StoredAccount = Omit<ServiceAccount, 'activeTokenCount' | 'scopes'>;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NETWORK_DELAY = 300;

let accounts: StoredAccount[] | null = null;
let tokens: Array<ServiceAccountToken & {accountId: string}> = [];
let lastId = 100;

function createId() {
  lastId += 1;
  return String(lastId);
}

function ago(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

function fromNow(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

const BOTH_GUARDRAILS: GuardrailId[] = ['cost_impact', 'data_irreversible'];

function getAccounts(): StoredAccount[] {
  if (accounts) {
    return accounts;
  }
  const projectIds = ProjectsStore.getState().projects.map(project => project.id);
  accounts = [
    {
      id: '1',
      name: 'github-actions-deploy',
      description: 'Uploads source maps and creates releases',
      bundleId: 'ci',
      guardrails: BOTH_GUARDRAILS,
      customScopes: [],
      allProjects: true,
      projectIds: [],
      createdBy: {name: 'Jane Doe'},
      dateCreated: ago(10 * DAY),
      dateLastActive: ago(12 * MINUTE),
    },
    {
      id: '2',
      name: 'triage-agent',
      description: 'Nightly issue triage',
      bundleId: 'default_agent',
      guardrails: BOTH_GUARDRAILS,
      customScopes: [],
      allProjects: false,
      projectIds: projectIds.slice(0, 3),
      createdBy: {name: 'Sam Lee'},
      dateCreated: ago(15 * DAY),
      dateLastActive: ago(6 * HOUR),
    },
    {
      id: '3',
      name: 'status-dashboard',
      description: '',
      bundleId: 'read_only',
      guardrails: BOTH_GUARDRAILS,
      customScopes: [],
      allProjects: false,
      projectIds: projectIds.slice(0, 2),
      createdBy: {name: 'Jane Doe'},
      dateCreated: ago(23 * DAY),
      dateLastActive: null,
    },
  ];

  const deployScopes = getScopes(accounts[0]!);
  tokens = [
    {
      accountId: '1',
      id: '11',
      name: 'prod deploy',
      tokenLastCharacters: '7f3a',
      scopes: deployScopes,
      createdBy: {name: 'Jane Doe'},
      dateCreated: ago(10 * DAY),
      dateLastUsed: ago(12 * MINUTE),
      dateExpires: fromNow(80 * DAY),
    },
    {
      accountId: '1',
      id: '12',
      name: 'staging sourcemaps',
      tokenLastCharacters: 'c19e',
      // `dashboard:write` isn't part of the CI bundle, to show a scope the account
      // was narrowed below.
      scopes: ['sourcemap:write', 'release:write', 'release:read', 'dashboard:write'],
      createdBy: {name: 'Sam Lee'},
      dateCreated: ago(9 * DAY),
      dateLastUsed: null,
      dateExpires: fromNow(6 * DAY),
    },
    {
      accountId: '1',
      id: '13',
      name: 'old ci key',
      tokenLastCharacters: '02bd',
      scopes: deployScopes,
      createdBy: {name: 'Jane Doe'},
      dateCreated: ago(103 * DAY),
      dateLastUsed: ago(13 * DAY),
      dateExpires: ago(2 * DAY),
    },
    {
      accountId: '2',
      id: '21',
      name: 'nightly triage',
      tokenLastCharacters: '9a41',
      scopes: getScopes(accounts[1]!),
      createdBy: {name: 'Sam Lee'},
      dateCreated: ago(15 * DAY),
      dateLastUsed: ago(6 * HOUR),
      dateExpires: fromNow(75 * DAY),
    },
  ];
  return accounts;
}

function getScopes(
  account: Pick<StoredAccount, 'bundleId' | 'customScopes' | 'guardrails'>
) {
  return resolveBundle(account).scopes;
}

function toResponse(account: StoredAccount): ServiceAccount {
  return {
    ...account,
    scopes: getScopes(account),
    activeTokenCount: tokens.filter(token => token.accountId === account.id).length,
  };
}

function respond<T>(getValue: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const value = getValue();
        // Copy so callers can't mutate the store by editing a response.
        resolve(value === undefined ? value : structuredClone(value));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }, NETWORK_DELAY);
  });
}

/** A 400 with errors keyed by field, like the API's validation errors. */
export class MockFieldError extends Error {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super(Object.values(fields).join(' '));
    this.name = 'MockFieldError';
    this.fields = fields;
  }
}

function findAccount(id: string) {
  const account = getAccounts().find(a => a.id === id);
  if (!account) {
    throw new Error('Service account not found.');
  }
  return account;
}

function assertUniqueName(name: string, exceptId?: string) {
  if (getAccounts().some(a => a.name === name && a.id !== exceptId)) {
    throw new MockFieldError({name: 'A service account with this name already exists.'});
  }
}

function generateToken(orgSlug: string) {
  const payload = btoa(
    JSON.stringify({
      iat: Math.floor(Date.now() / 1000),
      url: 'https://sentry.io',
      org: orgSlug,
    })
  ).replace(/=+$/, '');
  // Fake token, so it doesn't need a secure random source.
  const secret = Array.from({length: 48}, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return `sntrym_${payload}_${secret}`;
}

const queryKeys = {
  all: ['service-accounts-mock'] as const,
  list: () => [...queryKeys.all, 'list'] as const,
  detail: (id: string) => [...queryKeys.all, 'detail', id] as const,
  tokens: (id: string) => [...queryKeys.all, 'tokens', id] as const,
};

export function serviceAccountsOptions() {
  return queryOptions({
    queryKey: queryKeys.list(),
    queryFn: () => respond(() => getAccounts().map(toResponse)),
    staleTime: Infinity,
  });
}

export function serviceAccountOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.detail(id),
    queryFn: () => respond(() => toResponse(findAccount(id))),
    staleTime: Infinity,
  });
}

export function serviceAccountTokensOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.tokens(id),
    queryFn: () =>
      respond(() =>
        tokens
          .filter(token => token.accountId === id)
          .map(({accountId: _accountId, ...token}) => token)
          .sort((a, b) => b.dateCreated.localeCompare(a.dateCreated))
      ),
    staleTime: Infinity,
  });
}

function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({queryKey: queryKeys.all});
}

export function useCreateServiceAccount({createdBy}: {createdBy: string}) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: ServiceAccountInput) =>
      respond(() => {
        assertUniqueName(input.name);
        const account: StoredAccount = {
          ...input,
          id: createId(),
          createdBy: {name: createdBy},
          dateCreated: new Date().toISOString(),
          dateLastActive: null,
        };
        getAccounts().push(account);
        return toResponse(account);
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateServiceAccount(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: ServiceAccountInput) =>
      respond(() => {
        assertUniqueName(input.name, id);
        const account = findAccount(id);
        Object.assign(account, input);
        return toResponse(account);
      }),
    onSuccess: invalidate,
  });
}

/** Soft delete. Revokes every token in the same step. */
export function useDeleteServiceAccount(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: () =>
      respond(() => {
        accounts = getAccounts().filter(a => a.id !== id);
        tokens = tokens.filter(token => token.accountId !== id);
      }),
    onSuccess: invalidate,
  });
}

export function useCreateServiceAccountToken({
  accountId,
  createdBy,
  orgSlug,
}: {
  accountId: string;
  createdBy: string;
  orgSlug: string;
}) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: ServiceAccountTokenInput) =>
      respond((): NewServiceAccountToken => {
        findAccount(accountId);
        const token = generateToken(orgSlug);
        const created: ServiceAccountToken = {
          ...input,
          id: createId(),
          tokenLastCharacters: token.slice(-4),
          createdBy: {name: createdBy},
          dateCreated: new Date().toISOString(),
          dateLastUsed: null,
        };
        tokens.push({...created, accountId});
        return {...created, token};
      }),
    onSuccess: invalidate,
  });
}

export function useRevokeServiceAccountToken(accountId: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (tokenId: string) =>
      respond(() => {
        tokens = tokens.filter(
          token => !(token.accountId === accountId && token.id === tokenId)
        );
      }),
    onSuccess: invalidate,
  });
}
