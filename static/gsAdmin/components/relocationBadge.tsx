import {Tag, type TagProps} from 'sentry/components/core/badge/tag';

import type {Relocation} from 'admin/types';

type Props = {
  data: Relocation;
};

function RelocationBadge({data}: Props) {
  let text = '';
  let theme: TagProps['variant'] = 'muted';
  switch (data.status) {
    case 'IN_PROGRESS':
      text = 'Working';
      theme = 'info';
      break;
    case 'FAILURE':
      text = 'Failed';
      theme = 'danger';
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

  return <Tag variant={theme}>{text}</Tag>;
}

export default RelocationBadge;
