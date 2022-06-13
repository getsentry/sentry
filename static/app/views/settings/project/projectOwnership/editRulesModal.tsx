import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {EditOwnershipRulesModalOptions} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import OwnerInput from 'sentry/views/settings/project/projectOwnership/ownerInput';

type Props = EditOwnershipRulesModalOptions;
type State = {};

class EditOwnershipRulesModal extends Component<Props, State> {
  render() {
    const {ownership} = this.props;
    return (
      <Fragment>
        <Block>
          {t('Rules follow the pattern: ')} <code>type:glob owner owner</code>
        </Block>
        <Block>
          {t('Owners can be team identifiers starting with #, or user emails')}
        </Block>
        <Block>
          {t('Globbing Syntax:')}
          <CodeBlock>{'* matches everything\n? matches any single character'}</CodeBlock>
        </Block>
        <Block>
          {t('Examples')}
          <CodeBlock>
            path:src/example/pipeline/* person@sentry.io #infra
            {'\n'}
            module:com.module.name.example #sdks
            {'\n'}
            url:http://example.com/settings/* #product
            {'\n'}
            tags.sku_class:enterprise #enterprise
          </CodeBlock>
        </Block>
        {ownership && <OwnerInput {...this.props} initialText={ownership.raw || ''} />}
      </Fragment>
    );
  }
}

const Block = styled(TextBlock)`
  margin-bottom: 16px;
`;

const CodeBlock = styled('pre')`
  word-break: break-all;
  white-space: pre-wrap;
`;

export default EditOwnershipRulesModal;
