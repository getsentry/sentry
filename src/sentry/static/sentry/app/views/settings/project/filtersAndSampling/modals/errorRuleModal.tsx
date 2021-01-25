import {t} from 'app/locale';

import Form from './form';

type Props = Form['props'];

type State = Form['state'];

class ErrorRuleModal extends Form<Props, State> {
  getModalTitle() {
    return t('Add a custom rule for errors');
  }

  geTransactionFieldDescription() {
    return {
      label: t('Error'),
      help: t('This is a description'),
    };
  }
}

export default ErrorRuleModal;
