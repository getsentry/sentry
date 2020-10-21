import { PureComponent } from 'react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import TextField from 'app/views/settings/components/forms/textField';

type Props = {
  disabled: boolean;
};

class RuleNameForm extends PureComponent<Props> {
  render() {
    const {disabled} = this.props;

    return (
      <Panel>
        <PanelHeader>{t('Give your rule a name')}</PanelHeader>
        <PanelBody>
          <TextField
            disabled={disabled}
            name="name"
            label={t('Rule Name')}
            help={t('Give your rule a name so it is easy to manage later')}
            placeholder={t('Something really bad happened')}
            required
          />
        </PanelBody>
      </Panel>
    );
  }
}

export default RuleNameForm;
