import {Component, Fragment} from 'react';
import {components} from 'react-select';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldErrorReason from 'sentry/components/forms/field/fieldErrorReason';
import FormField from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import FormModel from 'sentry/components/forms/model';
import {ProjectMapperType} from 'sentry/components/forms/types';
import IdBadge from 'sentry/components/idBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import {PanelAlert} from 'sentry/components/panels';
import {
  IconAdd,
  IconArrow,
  IconDelete,
  IconGeneric,
  IconOpen,
  IconVercel,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {safeGetQsParam} from 'sentry/utils/integrationUtil';
import {removeAtArrayIndex} from 'sentry/utils/removeAtArrayIndex';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps} from './inputField';

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
      error,
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

    const projectOptions = sentryProjects.map(({slug, id}) => ({label: slug, value: id}));

    const mappedItemsToShow = mappedDropdownItems.filter(
      item => !mappedValuesUsed.has(item.value)
    );

    const handleSelectProject = ({value}: {value: number}) => {
      this.setState({selectedSentryProjectId: value});
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
              type="button"
              aria-label={t('Delete')}
            />
          </DeleteButtonWrapper>
        </Item>
      );
    };

    const customValueContainer = containerProps => {
      // if no value set, we want to return the default component that is rendered
      const project = sentryProjectsById[selectedSentryProjectId || ''];
      if (!project) {
        return <components.ValueContainer {...containerProps} />;
      }
      return (
        <components.ValueContainer {...containerProps}>
          <IdBadge
            project={project}
            avatarSize={20}
            displayName={project.slug}
            avatarProps={{consistentWidth: true}}
            disableLink
          />
        </components.ValueContainer>
      );
    };

    const customOptionProject = projectProps => {
      const project = sentryProjectsById[projectProps.value];
      // Should never happen for a dropdown item
      if (!project) {
        return null;
      }
      return (
        <components.Option {...projectProps}>
          <IdBadge
            project={project}
            avatarSize={20}
            displayName={project.slug}
            avatarProps={{consistentWidth: true}}
            disableLink
          />
        </components.Option>
      );
    };

    const customMappedValueContainer = containerProps => {
      // if no value set, we want to return the default component that is rendered
      const mappedValue = mappedItemsByValue[selectedMappedValue || ''];
      if (!mappedValue) {
        return <components.ValueContainer {...containerProps} />;
      }
      return (
        <components.ValueContainer {...containerProps}>
          <IntegrationIconWrapper>{getIcon(iconType)}</IntegrationIconWrapper>
          <OptionLabelWrapper>{mappedValue.label}</OptionLabelWrapper>
        </components.ValueContainer>
      );
    };

    const customOptionMappedValue = optionProps => {
      return (
        <components.Option {...optionProps}>
          <OptionWrapper>
            <IntegrationIconWrapper>{getIcon(iconType)}</IntegrationIconWrapper>
            <OptionLabelWrapper>{optionProps.label}</OptionLabelWrapper>
          </OptionWrapper>
        </components.Option>
      );
    };

    return (
      <Fragment>
        {existingValues.map(renderItem)}
        <Item>
          <SelectControl
            placeholder={mappedValuePlaceholder}
            name="mappedDropdown"
            options={mappedItemsToShow}
            components={{
              Option: customOptionMappedValue,
              ValueContainer: customMappedValueContainer,
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
              Option: customOptionProject,
              ValueContainer: customValueContainer,
            }}
            onChange={handleSelectProject}
            value={selectedSentryProjectId}
          />
          <AddProjectWrapper>
            <Button
              type="button"
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
              <div>
                <FormFieldControlState model={model} name={formElementId} />
                {error ? <StyledFieldErrorReason>{error}</StyledFieldErrorReason> : null}
              </div>
            )}
          </FieldControlWrapper>
        </Item>
        {nextUrl && (
          <NextButtonPanelAlert type="muted">
            <NextButtonWrapper>
              {nextDescription ?? ''}
              <Button
                type="button"
                size="sm"
                priority="primary"
                icon={<IconOpen size="xs" />}
                disabled={!existingValues.length}
                href={nextUrl}
                title={DISABLED_TOOLTIP_TEXT}
                tooltipProps={{
                  disabled: !!existingValues.length,
                }}
              >
                {nextButtonText}
              </Button>
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

const OptionLabelWrapper = styled('div')`
  margin-left: ${space(0.5)};
`;

const StyledFormField = styled(FormField)`
  padding: 0;
`;

const StyledExternalLink = styled(ExternalLink)`
  display: flex;
`;

const OptionWrapper = styled('div')`
  align-items: center;
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

const StyledFieldErrorReason = styled(FieldErrorReason)``;
