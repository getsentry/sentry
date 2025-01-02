import {Component, Fragment} from 'react';
import {components} from 'react-select';
import styled from '@emotion/styled';
import difference from 'lodash/difference';

import {openProjectCreationModal} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import FormField from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import type FormModel from 'sentry/components/forms/model';
import type {ProjectMapperType} from 'sentry/components/forms/types';
import IdBadge from 'sentry/components/idBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import PanelAlert from 'sentry/components/panels/panelAlert';
import {
  IconAdd,
  IconArrow,
  IconDelete,
  IconGeneric,
  IconOpen,
  IconVercel,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import removeAtArrayIndex from 'sentry/utils/array/removeAtArrayIndex';
import {safeGetQsParam} from 'sentry/utils/integrationUtil';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps} from './inputField';

export interface ProjectMapperProps extends Omit<InputFieldProps, 'type'> {}

interface RenderProps extends ProjectMapperProps, ProjectMapperType {
  model: FormModel;
}

type MappedValue = string | number;

type State = {
  selectedMappedValue: MappedValue | null;
  selectedSentryProjectId: number | null;
};

const DISABLED_TOOLTIP_TEXT = 'Please link at least one project to continue.';

// Get the icon
const getIcon = (iconType: string) => {
  switch (iconType) {
    case 'vercel':
      return <IconVercel />;
    default:
      return <IconGeneric />;
  }
};

export class RenderField extends Component<RenderProps, State> {
  state: State = {
    selectedSentryProjectId: null,
    selectedMappedValue: null,
  };

  componentDidUpdate(prevProps: RenderProps) {
    const projectIds = this.props.sentryProjects.map(project => project.id);
    const prevProjectIds = prevProps.sentryProjects.map(project => project.id);
    const newProjects = difference(projectIds, prevProjectIds);

    if (newProjects.length === 1) {
      this.setState({
        selectedSentryProjectId: newProjects[0]!,
      });
    }
  }

  render() {
    const {
      onChange,
      onBlur,
      value: incomingValues,
      sentryProjects,
      mappedDropdown: {items: mappedDropdownItems, placeholder: mappedValuePlaceholder},
      nextButton: {text: nextButtonText, description: nextDescription, allowedDomain},
      iconType,
      model,
      id: formElementId,
    } = this.props;

    const existingValues: Array<[number, MappedValue]> = incomingValues || [];
    const nextUrlOrArray = safeGetQsParam('next');
    let nextUrl = Array.isArray(nextUrlOrArray) ? nextUrlOrArray[0] : nextUrlOrArray;

    if (nextUrl && !nextUrl.startsWith(allowedDomain)) {
      // eslint-disable-next-line no-console
      console.warn(`Got unexpected next url: ${nextUrl}`);
      nextUrl = undefined;
    }

    const {selectedSentryProjectId, selectedMappedValue} = this.state;

    // create maps by the project id for constant time lookups
    const sentryProjectsById = Object.fromEntries(
      sentryProjects.map(project => [project.id, project])
    );

    const mappedItemsByValue = Object.fromEntries(
      mappedDropdownItems.map(item => [item.value, item])
    );

    // prevent a single mapped item from being associated with multiple Sentry projects
    const mappedValuesUsed = new Set(existingValues.map(tuple => tuple[1]));

    const renderIdBadge = ({id, hideName}: {hideName: boolean; id: number | null}) => {
      const project = sentryProjectsById[id || ''];
      return (
        <IdBadge
          project={project}
          avatarProps={{consistentWidth: true}}
          avatarSize={16}
          disableLink
          hideName={hideName}
        />
      );
    };

    const sentryProjectOptions = sentryProjects.map(({slug, id}) => ({
      label: slug,
      value: id,
      leadingItems: renderIdBadge({id, hideName: true}),
    }));

    const projectOptions = [
      {label: t('Create a Project'), value: -1, leadingItems: <IconAdd isCircled />},
      ...sentryProjectOptions,
    ];

    const mappedItemsToShow = mappedDropdownItems.filter(
      item => !mappedValuesUsed.has(item.value)
    );
    const mappedItemOptions = mappedItemsToShow.map(mappedItem => ({
      ...mappedItem,
      leadingItems: getIcon(iconType),
    }));

    const handleSelectProject = ({value}: {value: number}) => {
      if (value === -1) {
        openProjectCreationModal({
          defaultCategory: iconType === 'vercel' ? 'browser' : 'popular',
        });
      } else {
        this.setState({selectedSentryProjectId: value});
      }
    };

    const handleSelectMappedValue = ({value}: {value: MappedValue}) => {
      this.setState({selectedMappedValue: value});
    };

    const handleAdd = () => {
      // add the new value to the list of existing values
      const projectMappings = [
        ...existingValues,
        [selectedSentryProjectId, selectedMappedValue],
      ];
      // trigger events so we save the value and show the check mark
      onChange?.(projectMappings, []);
      onBlur?.(projectMappings, []);
      this.setState({selectedSentryProjectId: null, selectedMappedValue: null});
    };

    const handleDelete = (index: number) => {
      const projectMappings = removeAtArrayIndex(existingValues, index);
      // trigger events so we save the value and show the check mark
      onChange?.(projectMappings, []);
      onBlur?.(projectMappings, []);
    };

    const renderItem = (itemTuple: [number, any], index: number) => {
      const [projectId, mappedValue] = itemTuple;
      const project = sentryProjectsById[projectId];
      // TODO: add special formatting if deleted
      const mappedItem = mappedItemsByValue[mappedValue];
      return (
        <Item key={index}>
          <MappedItemValue>
            {mappedItem ? (
              <Fragment>
                <IntegrationIconWrapper>{getIcon(iconType)}</IntegrationIconWrapper>
                {mappedItem.label}
                <StyledExternalLink href={mappedItem.url}>
                  <IconOpen size="xs" />
                </StyledExternalLink>
              </Fragment>
            ) : (
              t('Deleted')
            )}
          </MappedItemValue>
          <RightArrow size="xs" direction="right" />
          <MappedProjectWrapper>
            {project ? (
              <IdBadge
                project={project}
                avatarSize={20}
                displayName={project.slug}
                avatarProps={{consistentWidth: true}}
              />
            ) : (
              t('Deleted')
            )}
          </MappedProjectWrapper>
          <DeleteButtonWrapper>
            <Button
              onClick={() => handleDelete(index)}
              icon={<IconDelete color="gray300" />}
              size="sm"
              aria-label={t('Delete')}
            />
          </DeleteButtonWrapper>
        </Item>
      );
    };

    return (
      <Fragment>
        {existingValues.map(renderItem)}
        <Item>
          <SelectControl
            placeholder={mappedValuePlaceholder}
            name="mappedDropdown"
            options={mappedItemOptions}
            components={{
              SingleValue: containerProps => {
                return (
                  <components.ValueContainer {...containerProps}>
                    <MappedValueContainer>
                      {containerProps.data.leadingItems}
                      {containerProps.children}
                    </MappedValueContainer>
                  </components.ValueContainer>
                );
              },
            }}
            onChange={handleSelectMappedValue}
            value={selectedMappedValue}
          />
          <RightArrow size="xs" direction="right" />
          <SelectControl
            placeholder={t('Sentry project\u2026')}
            name="project"
            options={projectOptions}
            components={{
              SingleValue: containerProps => {
                return (
                  <components.ValueContainer {...containerProps}>
                    {renderIdBadge({id: selectedSentryProjectId, hideName: false})}
                  </components.ValueContainer>
                );
              },
            }}
            onChange={handleSelectProject}
            value={selectedSentryProjectId}
          />
          <AddProjectWrapper>
            <Button
              disabled={!selectedSentryProjectId || !selectedMappedValue}
              size="sm"
              priority="primary"
              onClick={handleAdd}
              icon={<IconAdd />}
              aria-label={t('Add project')}
            />
          </AddProjectWrapper>
          <FieldControlWrapper>
            {formElementId && (
              <FormFieldControlState model={model} name={formElementId} />
            )}
          </FieldControlWrapper>
        </Item>
        {nextUrl && (
          <NextButtonPanelAlert type="muted">
            <NextButtonWrapper>
              {nextDescription ?? ''}
              <LinkButton
                size="sm"
                priority="primary"
                icon={<IconOpen />}
                disabled={!existingValues.length}
                href={nextUrl}
                title={DISABLED_TOOLTIP_TEXT}
                tooltipProps={{
                  disabled: !!existingValues.length,
                }}
              >
                {nextButtonText}
              </LinkButton>
            </NextButtonWrapper>
          </NextButtonPanelAlert>
        )}
      </Fragment>
    );
  }
}

function ProjectMapperField(props: InputFieldProps) {
  return (
    <StyledFormField
      {...props}
      resetOnError
      inline={false}
      stacked={false}
      hideControlState
    >
      {(renderProps: RenderProps) => <RenderField {...renderProps} />}
    </StyledFormField>
  );
}

export default ProjectMapperField;

const MappedProjectWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-right: ${space(1)};
  grid-area: sentry-project;
`;

const Item = styled('div')`
  min-height: 60px;
  padding: ${space(2)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }

  display: grid;
  grid-column-gap: ${space(1)};
  align-items: center;
  grid-template-columns: 2.5fr min-content 2.5fr max-content 30px;
  grid-template-areas: 'mapped-value arrow sentry-project manage-project field-control';
`;

const MappedItemValue = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  align-items: center;
  gap: ${space(1)};
  width: 100%;
  grid-area: mapped-value;
`;

const RightArrow = styled(IconArrow)`
  grid-area: arrow;
`;

const DeleteButtonWrapper = styled('div')`
  grid-area: manage-project;
`;

const IntegrationIconWrapper = styled('span')`
  display: flex;
  align-items: center;
`;

const AddProjectWrapper = styled('div')`
  grid-area: manage-project;
`;

const StyledFormField = styled(FormField)`
  padding: 0;
`;

const StyledExternalLink = styled(ExternalLink)`
  display: flex;
`;

const FieldControlWrapper = styled('div')`
  position: relative;
  grid-area: field-control;
`;

const NextButtonPanelAlert = styled(PanelAlert)`
  align-items: center;
  margin-bottom: -1px;
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
`;

const NextButtonWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
  align-items: center;
`;

const MappedValueContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
