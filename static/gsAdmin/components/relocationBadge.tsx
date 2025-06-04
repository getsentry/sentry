import type {Theme} from '@emotion/react';

import {Tag} from 'sentry/components/core/badge/tag';

import type {Relocation} from 'admin/types';

type Props = {
  data: Relocation;
};

function RelocationBadge({data}: Props) {
  let text = '';
  let theme: keyof Theme['tag'] = 'default';
  switch (data.status) {
    case 'IN_PROGRESS':
      text = 'Working';
      theme = 'highlight';
      break;
    case 'FAILURE':
      text = 'Failed';
      theme = 'error';
      break;
    case 'SUCCESS':
      text = 'Succeeded';
      theme = 'success';
      break;
    case 'PAUSE':
      text = 'Paused';
      theme = 'warning';
      break;
    default:
      break;
  }

  if (
    (data.status === 'IN_PROGRESS' || data.status === 'PAUSE') &&
    data.scheduledCancelAtStep !== null
  ) {
    text = 'Cancelling';
    theme = 'promotion';
  }

  return <Tag type={theme}>{text}</Tag>;
}

export default RelocationBadge;
