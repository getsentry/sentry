import {Organization, SentryFunction} from 'sentry/types';

import ActionButtons from './actionButtons';

type Props = {
  onClickRemove: (org: Organization, sentryFn: SentryFunction) => void;
  org: Organization;
  sentryFn: SentryFunction;
};

const SentryFunctionRowButtons = ({org, sentryFn, onClickRemove}: Props) => {
  return <ActionButtons org={org} sentryFn={sentryFn} onDelete={onClickRemove} />;
};

export default SentryFunctionRowButtons;
