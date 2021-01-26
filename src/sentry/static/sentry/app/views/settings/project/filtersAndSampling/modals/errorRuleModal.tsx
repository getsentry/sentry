import {t} from 'app/locale';

import Form from './form';
import {Category} from './utils';

type Props = Form['props'];

type State = Form['state'];

class ErrorRuleModal extends Form<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
    };
  }

  getModalTitle() {
    return t('Add a custom rule for errors');
  }

  geTransactionFieldDescription() {
    return {
      label: t('Error'),
      help: t('This is a description'),
    };
  }

  getCategoryOptions() {
    // TODO(PRISCILA): Enable the disabled options below as soon as the backend supports
    // return [
    //   [Category.RELEASES, t('Releases')],
    // [Category.BROWSER_EXTENSIONS, t('Browser Extensions')],
    // [Category.LOCALHOST, t('Localhost')],
    // [Category.WEB_CRAWLERS, t('Web Crawlers')],
    // [Category.LEGACY_BROWSERS, t('Legacy Browsers')],
    // ] as Array<[string, string]>;

    return [
      [Category.RELEASES, t('Releases')],
      [Category.ENVIRONMENTS, t('Environments')],
      [Category.USERS, t('Users')],
    ] as Array<[string, string]>;
  }
}

export default ErrorRuleModal;
