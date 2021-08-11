import {Organization, SentryFunction} from 'app/types';

import ActionButtons from './actionButtons';

type Props = {
  org: Organization;
  sentryFn: SentryFunction;

  onClickRemove: (org: Organization, sentryFn: SentryFunction) => void;
};

const SentryFunctionRowButtons = ({org, sentryFn, onClickRemove}: Props) => {
  return <ActionButtons org={org} sentryFn={sentryFn} onDelete={onClickRemove} />;
};

export default SentryFunctionRowButtons;
