import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import ModalManager from '../modalManager';

import Item from './item';
import Terminal from './terminal';

class Add extends ModalManager {
  getTitle() {
    return t('Register Key');
  }

  getBtnSaveLabel() {
    return t('Register');
  }

  getData() {
    const {savedRelays} = this.props;
    const trustedRelays = [...savedRelays, this.state.values];

    return {trustedRelays};
  }

  getContent() {
    return (
      <StyledList symbol="colored-numeric">
        <Item
          title={
            <div>
              {tct('Initialize the configuration. [link: Learn how]', {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/relay/getting-started/#initializing-configuration" />
                ),
              })}
            </div>
          }
          subtitle={t('Within your terminal:')}
        >
          <Terminal command="relay config init" />
        </Item>
        <Item
          title={
            <div>
              {tct(
                'Go to the file [jsonFile: credentials.json] to find the public key and enter it below.',
                {
                  jsonFile: (
                    <ExternalLink href="https://docs.sentry.io/product/relay/getting-started/#registering-relay-with-sentry" />
                  ),
                }
              )}
            </div>
          }
        >
          {super.getForm()}
        </Item>
      </StyledList>
    );
  }
}

export default Add;

const StyledList = styled(List)`
  display: grid;
  gap: ${space(3)};
`;
