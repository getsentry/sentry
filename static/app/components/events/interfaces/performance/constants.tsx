import {t} from 'sentry/locale';

import {ResourceLink} from './resources';

export const PYTHON_RESOURCE_LINKS: ResourceLink[] = [
  {
    text: t('Finding and Fixing Django N+1 Problems'),
    link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
  },
  {
    text: t('Rails Guide: Active Record Query Interface'),
    link: 'https://guides.rubyonrails.org/active_record_querying.html#eager-loading-associations',
  },
  {
    text: t('Django select_related and prefetch_related'),
    link: 'https://betterprogramming.pub/django-select-related-and-prefetch-related-f23043fd635d',
  },
  // TODO: Add another link to the python platforms when we have created our own blogpost + documentation for N+1s
];
