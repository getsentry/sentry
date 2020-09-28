import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import theme from 'app/utils/theme';
import {openModal} from 'app/actionCreators/modal';
import {Panel, PanelTable} from 'app/components/panels';
import {t, tct} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {Organization, Relay} from 'app/types';
import ExternalLink from 'app/components/links/externalLink';
import Button from 'app/components/button';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TextOverflow from 'app/components/textOverflow';
import Clipboard from 'app/components/clipboard';
import {IconAdd, IconTelescope, IconEdit, IconCopy, IconDelete} from 'app/icons';
import DateTime from 'app/components/dateTime';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import QuestionTooltip from 'app/components/questionTooltip';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import AsyncView from 'app/views/asyncView';

import Add from './modals/add';
import Edit from './modals/edit';

const RELAY_DOCS_LINK = 'https://getsentry.github.io/relay/';

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type State = {
  relays: Array<Relay>;
} & AsyncView['state'];

class RelayWrapper extends AsyncView<Props, State> {
  getTitle() {
    return t('Relay');
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      relays: this.props.organization.trustedRelays,
    };
  }

  setRelays(trustedRelays: Array<Relay>) {
    this.setState({relays: trustedRelays});
  }

  handleDelete = (publicKey: Relay['publicKey']) => async () => {
    const {relays} = this.state;

    const trustedRelays = relays
      .filter(relay => relay.publicKey !== publicKey)
      .map(relay => omit(relay, ['created', 'lastModified']));

    try {
      const response = await this.api.requestPromise(
        `/organizations/${this.props.organization.slug}/`,
        {
          method: 'PUT',
          data: {trustedRelays},
        }
      );
      addSuccessMessage(t('Successfully deleted Relay public key'));
      this.setRelays(response.trustedRelays);
    } catch {
      addErrorMessage(t('An unknown error occurred while deleting Relay public key'));
    }
  };

  successfullySaved(response: Organization, successMessage: string) {
    addSuccessMessage(successMessage);
    this.setRelays(response.trustedRelays);
  }

  handleOpenEditDialog = (publicKey: Relay['publicKey']) => () => {
    const editRelay = this.state.relays.find(relay => relay.publicKey === publicKey);

    if (!editRelay) {
      return;
    }

    openModal(modalProps => (
      <Edit
        {...modalProps}
        savedRelays={this.state.relays}
        api={this.api}
        orgSlug={this.props.organization.slug}
        relay={editRelay}
        onSubmitSuccess={response => {
          this.successfullySaved(response, t('Successfully updated Relay public key'));
        }}
      />
    ));
  };

  handleOpenAddDialog = () => {
    openModal(modalProps => (
      <Add
        {...modalProps}
        savedRelays={this.state.relays}
        api={this.api}
        orgSlug={this.props.organization.slug}
        onSubmitSuccess={response => {
          this.successfullySaved(response, t('Successfully added Relay public key'));
        }}
      />
    ));
  };

  renderBody() {
    const {relays} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Relay')}
          action={
            <Button
              priority="primary"
              size="small"
              icon={<IconAdd size="xs" isCircled />}
              onClick={this.handleOpenAddDialog}
            >
              {t('Register Key')}
            </Button>
          }
        />
        <TextBlock>
          {tct(`Go to [link:Relay Documentation] for setup and details.`, {
            link: <ExternalLink href={RELAY_DOCS_LINK} />,
          })}
        </TextBlock>
        {!relays.length ? (
          <Panel>
            <EmptyMessage
              icon={<IconTelescope size="xl" />}
              title={t('The middle layer between your app and Sentry!')}
              description={t(
                'Scrub all personal information before it arrives in Sentry. Relay impove’s event reponse time and acts as a proxy for organizations that restrict HTTP communication.'
              )}
              action={
                <EmptyMessageActions>
                  <Button href={RELAY_DOCS_LINK} target="_blank">
                    {t('Go to docs')}
                  </Button>
                  <Button
                    priority="primary"
                    icon={<IconAdd isCircled />}
                    onClick={this.handleOpenAddDialog}
                  >
                    {t('Register Key')}
                  </Button>
                </EmptyMessageActions>
              }
            />
          </Panel>
        ) : (
          <StyledPanelTable
            headers={[t('Display Name'), t('Relay Key'), t('Date Created'), '']}
          >
            {relays.map(({publicKey: key, name, created, description}) => {
              const maskedKey = '*************************';
              return (
                <React.Fragment key={key}>
                  <Name>
                    <Text>{name}</Text>
                    {description && (
                      <QuestionTooltip position="top" size="sm" title={description} />
                    )}
                  </Name>
                  <KeyWrapper>
                    <Key content={maskedKey}>{maskedKey}</Key>
                    <IconWrapper>
                      <Clipboard value={key}>
                        <Tooltip title={t('Click to copy')} containerDisplayMode="flex">
                          <IconCopy color="gray500" />
                        </Tooltip>
                      </Clipboard>
                    </IconWrapper>
                  </KeyWrapper>
                  <Text>
                    {!defined(created) ? t('Unknown') : <DateTime date={created} />}
                  </Text>
                  <Actions>
                    <Button
                      size="small"
                      title={t('Edit Key')}
                      label={t('Edit Key')}
                      icon={<IconEdit size="sm" />}
                      onClick={this.handleOpenEditDialog(key)}
                    />
                    <Button
                      size="small"
                      title={t('Delete Key')}
                      label={t('Delete Key')}
                      onClick={this.handleDelete(key)}
                      icon={<IconDelete size="sm" />}
                    />
                  </Actions>
                </React.Fragment>
              );
            })}
          </StyledPanelTable>
        )}
      </React.Fragment>
    );
  }
}

export default RelayWrapper;

const EmptyMessageActions = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: ${space(1)};
  align-items: center;
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: repeat(3, auto) max-content;
  > * {
    @media (max-width: ${theme.breakpoints[0]}) {
      padding: ${space(1)};
    }
  }
`;

const KeyWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-gap: ${space(1)};
  align-items: center;
`;

const IconWrapper = styled('div')`
  justify-content: flex-start;
  display: flex;
  cursor: pointer;
`;

const Text = styled(TextOverflow)`
  color: ${p => p.theme.gray700};
  line-height: 30px;
`;

const Key = styled(Text)<{content: string}>`
  visibility: hidden;
  position: relative;
  :after {
    position: absolute;
    top: 4px;
    left: 0;
    content: '${p => p.content}';
    visibility: visible;
    ${overflowEllipsis};
  }
`;

const Actions = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-gap: ${space(1)};
  align-items: center;
`;

const Name = styled(Actions)``;
