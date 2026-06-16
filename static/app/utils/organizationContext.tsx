import {createContext} from 'react';

import type {Organization} from 'sentry/types/organization';

/**
 * Holds the current organization if loaded.
 */
export const OrganizationContext = createContext<Organization | null>(null);
