import {Fragment} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import Access from 'sentry/components/acl/access';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconAdd, IconArrow, IconDelete, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import space from 'sentry/styles/space';
import {ExternalActorMapping, Integration, Organization} from 'sentry/types';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

type CodeOwnersAssociationMappings = {
  [projectSlug: string]: {
    associations: {
      [externalName: string]: string;
    };
    errors: {
      [errorKey: string]: string;
    };
  };
};

type Props = AsyncComponent['props'] & {
  organization: Organization;
  integration: Integration;
  mappings: ExternalActorMapping[];
  type: 'team' | 'user';
  onCreateOrEdit: (mapping?: ExternalActorMapping) => void;
  onDelete: (mapping: ExternalActorMapping) => void;
  pageLinks?: string;
};

type State = AsyncComponent['state'] & {
  associationMappings: CodeOwnersAssociationMappings;
};

class IntegrationExternalMappings extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [
      [
        'associationMappings',
        `/organizations/${organization.slug}/codeowners-associations/`,
      ],
    ];
  }

  getUnassociatedMappings() {
    const {type} = this.props;
    const {associationMappings} = this.state;
    const errorKey = `missing_external_${type}s`;
    const unassociatedMappings = Object.values(associationMappings).reduce(
      (map, {errors}) => {
        return new Set<string>([...map, ...errors[errorKey]]);
      },
      new Set<string>()
    );
    return Array.from(unassociatedMappings).map(externalName => ({
      externalName,
      sentryName: '',
    }));
  }

  renderBody() {
    const {integration, mappings, type, onCreateOrEdit, onDelete, pageLinks} = this.props;
    const allMappings = [
      // ...this.getUnassociatedMappings(),
      ...mappings,
    ];
    return (
      <Fragment>
        <Panel>
          <PanelHeader disablePadding hasButtons>
            <HeaderLayout>
              <ExternalNameColumn header>
                {tct('External [type]', {type})}
              </ExternalNameColumn>
              <ArrowColumn>
                <IconArrow direction="right" size="md" />
              </ArrowColumn>
              <SentryNameColumn>{tct('Sentry [type]', {type})}</SentryNameColumn>
              <Access access={['org:integrations']}>
                {({hasAccess}) => (
                  <ButtonColumn>
                    <Tooltip
                      title={tct(
                        'You must be an organization owner, manager or admin to edit or remove a [type] mapping.',
                        {type}
                      )}
                      disabled={hasAccess}
                    >
                      <AddButton
                        data-test-id="add-mapping-button"
                        onClick={() => onCreateOrEdit()}
                        size="xsmall"
                        icon={<IconAdd size="xs" isCircled />}
                        disabled={!hasAccess}
                      >
                        {tct('Add [type] Mapping', {type})}
                      </AddButton>
                    </Tooltip>
                  </ButtonColumn>
                )}
              </Access>
            </HeaderLayout>
          </PanelHeader>
          <PanelBody>
            {!mappings.length && (
              <EmptyMessage icon={getIntegrationIcon(integration.provider.key, 'lg')}>
                {tct('Set up External [type] Mappings.', {type: capitalize(type)})}
              </EmptyMessage>
            )}
            {allMappings.map((item, index) => (
              <Access access={['org:integrations']} key={index}>
                {({hasAccess}) => (
                  <ConfigPanelItem>
                    <Layout>
                      <ExternalNameColumn>
                        <StyledPluginIcon pluginId={integration.provider.key} size={19} />
                        <span>{item.externalName}</span>
                      </ExternalNameColumn>
                      <ArrowColumn>
                        <IconArrow direction="right" size="md" />
                      </ArrowColumn>
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
                            aria-label={t('edit')}
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
                              aria-label={t('delete')}
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
        <Pagination pageLinks={pageLinks} />
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
  padding: ${space(1)};
  width: 100%;
  align-items: center;
  grid-template-columns: 2.5fr 50px 2.5fr 1fr;
  grid-template-areas: 'external-name arrow sentry-name button';
`;

const HeaderLayout = styled(Layout)`
  align-items: center;
  padding: 0 ${space(1)} 0 ${space(2)};
  text-transform: uppercase;
`;

const ConfigPanelItem = styled(PanelItem)`
  padding: 0 ${space(1)};
`;

const StyledButton = styled(Button)`
  margin: ${space(0.5)};
`;

const StyledPluginIcon = styled(PluginIcon)`
  margin-right: ${space(2)};
`;

// Columns below
const Column = styled('span')`
  overflow: hidden;
  overflow-wrap: break-word;
`;

const ExternalNameColumn = styled(Column)<{header?: boolean}>`
  grid-area: external-name;
  display: flex;
  align-items: center;
  font-family: ${p => (p.header ? 'inherit' : p.theme.text.familyMono)};
`;

const ArrowColumn = styled(Column)`
  grid-area: arrow;
`;

const SentryNameColumn = styled(Column)`
  grid-area: sentry-name;
`;

const ButtonColumn = styled(Column)`
  grid-area: button;
  text-align: right;
`;
