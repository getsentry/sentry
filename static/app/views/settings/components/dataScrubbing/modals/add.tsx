import {t} from 'sentry/locale';

import {Rule} from '../types';

import ModalManager from './modalManager';

type ModalManagerProps = ModalManager['props'];
type Props = Omit<ModalManagerProps, 'title' | 'initialValues' | 'onGetNewRules'>;

function Add({savedRules, ...props}: Props) {
  const handleGetNewRules = (
    values: Parameters<ModalManagerProps['onGetNewRules']>[0]
  ) => {
    return [...savedRules, {...values, id: savedRules.length}] as Array<Rule>;
  };

  return (
    <ModalManager
      {...props}
      savedRules={savedRules}
      title={t('Add an advanced data scrubbing rule')}
      onGetNewRules={handleGetNewRules}
    />
  );
}

export default Add;
