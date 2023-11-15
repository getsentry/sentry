import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconChevron} from 'sentry/icons';
import {Scope} from 'sentry/types';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';

import {FieldObject, JsonFormObject} from './types';

export interface FormPanelProps {
  /**
   * List of fields to render
   */
  fields: FieldObject[];
  access?: Set<Scope>;
  additionalFieldProps?: {[key: string]: any};
  /**
   * Can the PanelBody be hidden with a click?
   */
  collapsible?: boolean;
  /**
   * Disables the entire form
   */
  disabled?: boolean;
  features?: Record<string, any>;
  /**
   * The name of the field that should be highlighted
   */
  highlighted?: string;
  initiallyCollapsed?: boolean;
  /**
   * Renders inside of PanelBody before PanelBody close
   */
  renderFooter?: (arg: JsonFormObject) => React.ReactNode;
  /**
   * Renders inside of PanelBody at the start
   */
  renderHeader?: (arg: JsonFormObject) => React.ReactNode;
  /**
   * Panel title
   */
  title?: React.ReactNode;
}

function FormPanel({
  additionalFieldProps = {},
  title,
  fields,
  access,
  disabled,
  renderFooter,
  renderHeader,
  collapsible,
  initiallyCollapsed = false,
  ...otherProps
}: FormPanelProps) {
  const [collapsed, setCollapse] = useState(initiallyCollapsed);
  const handleCollapseToggle = useCallback(() => setCollapse(current => !current), []);

  return (
    <Panel id={typeof title === 'string' ? sanitizeQuerySelector(title) : undefined}>
      {title && (
        <PanelHeader>
          {title}
          {collapsible && (
            <Collapse onClick={handleCollapseToggle}>
              <IconChevron
                data-test-id="form-panel-collapse-chevron"
                direction={collapsed ? 'down' : 'up'}
                size="xs"
              />
            </Collapse>
          )}
        </PanelHeader>
      )}
      <PanelBody hidden={collapsed}>
        {typeof renderHeader === 'function' && renderHeader({title, fields})}

        {fields.map(field => {
          if (typeof field === 'function') {
            return field();
          }

          const {defaultValue: _, ...fieldWithoutDefaultValue} = field;
          const fieldConfig =
            field.type === 'boolean' || field.type === 'bool'
              ? field
              : fieldWithoutDefaultValue;

          // Allow the form panel disabled prop to override the fields
          // disabled prop, with fallback to the fields disabled state.
          if (disabled === true) {
            fieldWithoutDefaultValue.disabled = true;
            fieldWithoutDefaultValue.disabledReason = undefined;
          }

          return (
            <FieldFromConfig
              access={access}
              disabled={disabled}
              key={field.name}
              {...otherProps}
              {...additionalFieldProps}
              field={fieldConfig}
              highlighted={otherProps.highlighted === `#${field.name}`}
            />
          );
        })}
        {typeof renderFooter === 'function' && renderFooter({title, fields})}
      </PanelBody>
    </Panel>
  );
}

export default FormPanel;

const Collapse = styled('span')`
  cursor: pointer;
`;
