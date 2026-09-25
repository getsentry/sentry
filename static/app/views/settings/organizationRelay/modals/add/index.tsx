import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {List} from 'sentry/components/list';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Relay} from 'sentry/types/relay';
import {ModalManager} from 'sentry/views/settings/organizationRelay/modals/modalManager';

import {Item} from './item';
import {Terminal} from './terminal';

type Props = ModalRenderProps & {
  onSubmitSuccess: (organization: Organization) => void;
  orgSlug: Organization['slug'];
  savedRelays: Relay[];
};

export function Add(props: Props) {
  return (
    <ModalManager
      {...props}
      title={t('Register Key')}
      btnSaveLabel={t('Register')}
      getData={(values, savedRelays) => ({
        trustedRelays: [...savedRelays, values],
      })}
      renderContent={form => (
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
            {form}
          </Item>
        </StyledList>
      )}
    />
  );
}

const StyledList = styled(List)`
  display: grid;
  gap: ${p => p.theme.space['2xl']};
`;
