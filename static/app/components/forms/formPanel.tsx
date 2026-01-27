import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';
import {Text} from '@sentry/scraps/text';

import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';

import type {FieldObject, JsonFormObject} from './types';

export interface FormPanelProps {
  /**
   * List of fields to render
   */
  fields: readonly FieldObject[];
  access?: Set<Scope>;
  additionalFieldProps?: Record<string, any>;
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
   * Used by the `collapsible` field type to adjust rendering of the form title
   */
  nested?: boolean;
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

export default function FormPanel({
  additionalFieldProps = {},
  title,
  fields,
  access,
  disabled,
  renderFooter,
  renderHeader,
  collapsible,
  initiallyCollapsed = false,
  nested = false,
  ...otherProps
}: FormPanelProps) {
  const [collapsed, setCollapse] = useState(initiallyCollapsed);
  const handleCollapseToggle = useCallback(() => setCollapse(current => !current), []);

  const panelBody = (
    <Fragment>
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
    </Fragment>
  );

  if (nested) {
    return (
      <Container padding="lg xl">
        <Flex padding="sm 0">
          {title && (
            <Button
              priority="link"
              onClick={handleCollapseToggle}
              aria-label={collapsed ? t('Expand Options') : t('Collapse Options')}
              aria-expanded={!collapsed}
            >
              <Text size="sm" bold={false}>
                <Flex align="center" gap="xs">
                  <IconChevron
                    data-test-id="form-panel-collapse-chevron"
                    direction={collapsed ? 'right' : 'down'}
                    size="xs"
                  />
                  {title}
                </Flex>
              </Text>
            </Button>
          )}
        </Flex>
        <PanelBody hidden={collapsed}>
          <Container border="primary" radius="md" padding="sm" data-test-id="body">
            {panelBody}
          </Container>
        </PanelBody>
      </Container>
    );
  }

  return (
    <Panel id={typeof title === 'string' ? sanitizeQuerySelector(title) : undefined}>
      {title && (
        <PanelHeader
          onClick={collapsible ? handleCollapseToggle : undefined}
          style={collapsible ? {cursor: 'pointer'} : undefined}
          role={collapsible ? 'button' : undefined}
          aria-label={collapsible ? t('Expand Options') : t('Panel')}
          aria-expanded={!collapsed}
        >
          {title}
          {collapsible && (
            <Collapse
              onClick={e => {
                e.stopPropagation();
                handleCollapseToggle();
              }}
            >
              <IconChevron
                data-test-id="form-panel-collapse-chevron"
                direction={collapsed ? 'down' : 'up'}
                size="xs"
              />
            </Collapse>
          )}
        </PanelHeader>
      )}
      <PanelBody hidden={collapsed}>{panelBody}</PanelBody>
    </Panel>
  );
}

const Collapse = styled('span')`
  cursor: pointer;
`;
