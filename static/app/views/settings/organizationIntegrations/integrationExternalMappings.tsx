import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Pagination} from '@sentry/scraps/pagination';

import {Confirm} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd, IconArrow, IconDelete} from 'sentry/icons';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t, tct} from 'sentry/locale';
import type {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  ExternalActorSuggestion,
  Integration,
} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {isExternalActorMapping} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import {IntegrationExternalMappingForm} from './integrationExternalMappingForm';

type CodeOwnersAssociationMappings = Record<
  string,
  {
    associations: Record<string, string>;
    errors: Record<string, string>;
  }
>;

type Props = Pick<
  React.ComponentProps<typeof IntegrationExternalMappingForm>,
  'getBaseFormEndpoint' | 'defaultOptions'
> & {
  integration: Integration;
  mappings: ExternalActorMapping[];
  onCreate: (mapping?: ExternalActorMappingOrSuggestion) => void;
  onDelete: (mapping: ExternalActorMapping) => void;
  type: 'team' | 'user';
  onSubmitSuccess?: () => Promise<void>;
  pageLinks?: string;
};

type LocationQuery = {
  cursor?: string;
};

export function IntegrationExternalMappings(props: Props) {
  const {
    integration,
    type,
    mappings,
    pageLinks,
    defaultOptions,
    onCreate,
    onDelete,
    onSubmitSuccess,
    getBaseFormEndpoint,
  } = props;

  const [newlyAssociatedMappings, setNewlyAssociatedMappings] = useState<
    ExternalActorMapping[]
  >([]);

  const organization = useOrganization();
  const location = useLocation<LocationQuery>();
  const {cursor} = location.query;
  const isFirstPage = cursor ? cursor.split(':')[1] === '0' : true;

  const {
    data: associationMappings,
    isPending,
    isError,
    refetch,
  } = useApiQuery<CodeOwnersAssociationMappings>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/codeowners-associations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {provider: integration.provider.key}},
    ],
    {staleTime: 0}
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const unassociatedMappings = (): ExternalActorSuggestion[] => {
    const errorKey = `missing_external_${type}s`;
    const unassociatedMappingsSet = Object.values(associationMappings).reduce(
      (map, {errors}) => {
        return new Set<string>([...map, ...errors[errorKey]!]);
      },
      new Set<string>()
    );
    return Array.from(unassociatedMappingsSet).map(externalName => ({externalName}));
  };

  const allMappings = (): ExternalActorMappingOrSuggestion[] => {
    if (!isFirstPage) {
      return mappings;
    }
    const inlineMappings = unassociatedMappings().map(mapping => {
      // If this mapping has been changed, replace it with the new version from its change's response
      // The new version will be used in IntegrationExternalMappingForm to update the apiMethod and apiEndpoint
      const newlyAssociatedMapping = newlyAssociatedMappings.find(
        ({externalName}) => externalName === mapping.externalName
      );

      return newlyAssociatedMapping ?? mapping;
    });
    return [...inlineMappings, ...mappings];
  };

  const renderMappingName = (mapping: ExternalActorMappingOrSuggestion) => {
    return (
      <IntegrationExternalMappingForm
        type={type}
        integration={integration}
        getBaseFormEndpoint={getBaseFormEndpoint}
        mapping={mapping}
        onSubmitSuccess={async (newMapping: ExternalActorMapping) => {
          setNewlyAssociatedMappings([
            ...newlyAssociatedMappings.filter(
              map => map.externalName !== newMapping.externalName
            ),
            newMapping,
          ]);
          await onSubmitSuccess?.();
        }}
        isInline
        defaultOptions={defaultOptions}
      />
    );
  };

  const renderMappingActions = (mapping: ExternalActorMappingOrSuggestion) => {
    const canDelete = organization.access.includes('org:integrations');
    return isExternalActorMapping(mapping) ? (
      <Confirm
        disabled={!canDelete}
        onConfirm={() => onDelete(mapping)}
        message={t('Are you sure you want to remove this external %s mapping?', type)}
      >
        <Button
          variant="transparent"
          size="sm"
          icon={<IconDelete size="sm" />}
          aria-label={t('Remove user mapping')}
          tooltipProps={{
            title: canDelete
              ? t('Remove user mapping')
              : t(
                  'You must be an organization owner, manager or admin to delete an external user mapping.'
                ),
          }}
        />
      </Confirm>
    ) : (
      <QuestionTooltip
        title={t('This %s mapping suggestion was generated from a CODEOWNERS file', type)}
        size="sm"
      />
    );
  };

  return (
    <Fragment>
      <MappingTable
        data-test-id="mapping-table"
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>
              {tct('External [type]', {type})}
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <IconArrow direction="right" size="sm" />
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              {tct('Sentry [type]', {type})}
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <AddButton
                data-test-id="add-mapping-button"
                onClick={() => onCreate()}
                size="xs"
                icon={<IconAdd />}
              >
                {tct('Add [type] Mapping', {type})}
              </AddButton>
            </SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {allMappings().length ? (
          allMappings().map((mapping, index) => (
            <SimpleTable.Row key={index}>
              <ExternalNameColumn>
                <StyledPluginIcon pluginId={integration.provider.key} size={19} />
                <span>{mapping.externalName}</span>
              </ExternalNameColumn>
              <SimpleTable.RowCell>
                <IconArrow direction="right" size="sm" variant="muted" />
              </SimpleTable.RowCell>
              <ExternalForm>{renderMappingName(mapping)}</ExternalForm>
              <SimpleTable.RowCell>{renderMappingActions(mapping)}</SimpleTable.RowCell>
            </SimpleTable.Row>
          ))
        ) : (
          <SimpleTable.Empty>
            {tct('Set up External [type] Mappings.', {type: capitalize(type)})}
          </SimpleTable.Empty>
        )}
      </MappingTable>
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

const MappingTable = styled(SimpleTable)`
  overflow: visible;
  grid-template-columns: 1fr max-content 1fr 66px;

  [role='columnheader'] {
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  }

  /* The flat nth-child(4n) form this replaced counted cells across the whole
     grid; with real rows the actions column is the fourth cell of each row. */
  [role='columnheader']:nth-child(4),
  [role='cell']:nth-child(4) {
    padding-right: ${p => p.theme.space.md};
    justify-content: end;
  }
`;

const StyledPluginIcon = styled(PluginIcon)`
  min-width: ${p => p.size}px;
  margin-right: ${p => p.theme.space.xl};
`;

const ExternalNameColumn = styled(SimpleTable.RowCell)`
  font-family: ${p => p.theme.font.family.mono};
`;

const AddButton = styled(Button)`
  align-self: end;
`;

const ExternalForm = styled(SimpleTable.RowCell)`
  width: 100%;
`;
