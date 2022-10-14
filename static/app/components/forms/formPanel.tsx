import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconChevron} from 'sentry/icons';
import {Scope} from 'sentry/types';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';

import {FieldObject, JsonFormObject} from './types';

type Props = {
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
};

function FormPanel({
  additionalFieldProps = {},
  title,
  fields,
  access,
  disabled,
  renderFooter,
  renderHeader,
  collapsible,
  ...otherProps
}: Props) {
  const [collapsed, setCollapse] = useState(false);
  const handleCollapseToggle = useCallback(() => setCollapse(current => !current), []);

  return (
    <Panel id={typeof title === 'string' ? sanitizeQuerySelector(title) : undefined}>
      {title && (
        <PanelHeader>
          {title}
          {collapsible && (
            <Collapse onClick={handleCollapseToggle}>
              <IconChevron direction={collapsed ? 'down' : 'up'} size="xs" />
            </Collapse>
          )}
        </PanelHeader>
      )}
      {!collapsed && (
        <PanelBody>
          {typeof renderHeader === 'function' && renderHeader({title, fields})}

          {fields.map(field => {
            if (typeof field === 'function') {
              return field();
            }

            const {defaultValue: _, ...fieldWithoutDefaultValue} = field;

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
                field={fieldWithoutDefaultValue}
                highlighted={otherProps.highlighted === `#${field.name}`}
              />
            );
          })}
          {typeof renderFooter === 'function' && renderFooter({title, fields})}
        </PanelBody>
      )}
    </Panel>
  );
}

export default FormPanel;

const Collapse = styled('span')`
  cursor: pointer;
`;
