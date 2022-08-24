import {createContext} from 'react';

import {Organization} from 'sentry/types';

export const OrganizationContext = createContext<Organization | null>(null);
