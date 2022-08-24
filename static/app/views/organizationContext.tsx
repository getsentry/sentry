import {createContext} from 'react';

import type {Organization} from 'sentry/types';

export const OrganizationContext = createContext<Organization | null>(null);
