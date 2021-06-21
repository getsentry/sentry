import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {IconAdd, IconDelete, IconEdit} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {ExternalActorMapping, Integration} from 'app/types';
import {getIntegrationIcon} from 'app/utils/integrationUtil';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type Props = {
  integration: Integration;
  mappings: {id: string; externalName: string; sentryName: string}[];
  type: 'team' | 'user';
  onCreateOrEdit: (mapping?: ExternalActorMapping) => void;
  onDelete: (mapping: ExternalActorMapping) => void;
};

type State = {};

class IntegrationExternalMappings extends Component<Props, State> {
  render() {
    const {integration, mappings, type, onCreateOrEdit, onDelete} = this.props;

    return (
      <Fragment>
        <Panel>
          <PanelHeader disablePadding hasButtons>
            <HeaderLayout>
              <ExternalNameColumn>{tct('External [type]', {type})}</ExternalNameColumn>
              <SentryNameColumn>{tct('Sentry [type]', {type})}</SentryNameColumn>
              <ButtonColumn>
                <AddButton
                  data-test-id="add-mapping-button"
                  onClick={() => onCreateOrEdit()}
                  size="xsmall"
                  icon={<IconAdd size="xs" isCircled />}
                >
                  {tct('Add [type] Mapping', {type})}
                </AddButton>
              </ButtonColumn>
            </HeaderLayout>
          </PanelHeader>
          <PanelBody>
            {!mappings.length && (
              <EmptyMessage icon={getIntegrationIcon(integration.provider.key, 'lg')}>
                {tct('Set up External [type] Mappings.', {type: capitalize(type)})}
              </EmptyMessage>
            )}
            {mappings.map(item => (
              <Access access={['org:integrations']} key={item.id}>
                {({hasAccess}) => (
                  <ConfigPanelItem>
                    <Layout>
                      <ExternalNameColumn>{item.externalName}</ExternalNameColumn>
                      <SentryNameColumn>{item.sentryName}</SentryNameColumn>
                      <ButtonColumn>
                        <Tooltip
                          title={t(
                            'You must be an organization owner, manager or admin to edit or remove an external user mapping.'
                          )}
                          disabled={hasAccess}
                        >
                          <StyledButton
                            size="small"
                            icon={<IconEdit size="sm" />}
                            label={t('edit')}
                            disabled={!hasAccess}
                            onClick={() => onCreateOrEdit(item)}
                          />
                          <Confirm
                            disabled={!hasAccess}
                            onConfirm={() => onDelete(item)}
                            message={t(
                              'Are you sure you want to remove this external user mapping?'
                            )}
                          >
                            <StyledButton
                              size="small"
                              icon={<IconDelete size="sm" />}
                              label={t('delete')}
                              disabled={!hasAccess}
                            />
                          </Confirm>
                        </Tooltip>
                      </ButtonColumn>
                    </Layout>
                  </ConfigPanelItem>
                )}
              </Access>
            ))}
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}

export default IntegrationExternalMappings;

const AddButton = styled(Button)`
  text-transform: capitalize;
`;

const Layout = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
  width: 100%;
  align-items: center;
  grid-template-columns: 2.5fr 2.5fr 1fr;
  grid-template-areas: 'external-name sentry-name button';
`;

const HeaderLayout = styled(Layout)`
  align-items: center;
  margin: 0;
  margin-left: ${space(2)};
  text-transform: uppercase;
`;

const ConfigPanelItem = styled(PanelItem)``;

const StyledButton = styled(Button)`
  margin: ${space(0.5)};
`;

// Columns below
const Column = styled('span')`
  overflow: hidden;
  overflow-wrap: break-word;
`;

const ExternalNameColumn = styled(Column)`
  grid-area: external-name;
`;

const SentryNameColumn = styled(Column)`
  grid-area: sentry-name;
`;

const ButtonColumn = styled(Column)`
  grid-area: button;
  text-align: right;
`;
