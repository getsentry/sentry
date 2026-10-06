import {createContext} from 'react';

import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';

/** Parent items flow from the route layout to the page. Titles stay in the page. */
export const SettingsBreadcrumbsContext = createContext<BreadcrumbListProps['items']>([]);
