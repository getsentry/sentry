import {Fragment, useEffect} from 'react';
import * as Sentry from '@sentry/react';
import scrollToElement from 'scroll-to-element';

import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import {defined} from 'sentry/utils';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import type {FormPanelProps} from './formPanel';
import FormPanel from './formPanel';
import type {Field, FieldObject, JsonFormObject} from './types';

interface JsonFormProps
  extends WithRouterProps,
    Omit<FormPanelProps, 'highlighted' | 'fields' | 'additionalFieldProps'> {
  additionalFieldProps?: Record<string, any>;

  /**
   * If `forms` is not defined, `title` + `fields` must be required.
   * Allows more fine grain control of title/fields
   */
  fields?: FieldObject[];

  /**
   * Fields that are grouped by "section"
   */
  forms?: JsonFormObject[];

  /**
   * INTERNAL FIELD: used by the `collapsible` field type to adjust rendering of the form title
   */
  nested?: boolean;
}

interface ChildFormPanelProps
  extends Pick<
    FormPanelProps,
    | 'access'
    | 'disabled'
    | 'features'
    | 'nested'
    | 'additionalFieldProps'
    | 'renderFooter'
    | 'renderHeader'
    | 'initiallyCollapsed'
    | 'collapsible'
  > {
  highlighted?: string;
}

function JsonForm({
  access,
  collapsible,
  initiallyCollapsed = false,
  fields: propFields,
  nested,
  title,
  forms,
  disabled,
  features,
  additionalFieldProps,
  renderFooter,
  renderHeader,
  location,
  params,
  router,
  routes,
  ...otherProps
}: JsonFormProps) {
  const scrollToHash = (toHash?: string): void => {
    // location.hash is optional because of tests.
    const hash = toHash || location?.hash;

    if (!hash) {
      return;
    }

    // Push onto callback queue so it runs after the DOM is updated,
    // this is required when navigating from a different page so that
    // the element is rendered on the page before trying to getElementById.
    try {
      scrollToElement(sanitizeQuerySelector(decodeURIComponent(hash)), {
        align: 'middle',
        offset: -100,
      });
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  useEffect(() => {
    const hash = location?.hash;
    scrollToHash(hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.hash]);

  const shouldDisplayForm = (fieldList: FieldObject[]): boolean => {
    const fieldsWithVisibleProp = fieldList.filter(
      (field): field is Field => typeof field !== 'function' && defined(field?.visible)
    );

    if (fieldList.length === fieldsWithVisibleProp.length) {
      const areAllFieldsHidden = fieldsWithVisibleProp.every(field => {
        if (typeof field.visible === 'function') {
          return !field.visible({
            access,
            collapsible,
            initiallyCollapsed,
            fields: propFields,
            nested,
            title,
            forms,
            disabled,
            features,
            renderFooter,
            renderHeader,
            location,
            params,
            router,
            routes,
            ...otherProps,
            ...additionalFieldProps,
          });
        }
        return !field.visible;
      });

      return !areAllFieldsHidden;
    }

    return true;
  };

  const renderForm = ({
    fields,
    formPanelProps,
    title: formTitle,
    initiallyCollapsed: formInitiallyCollapsed,
  }: {
    fields: FieldObject[];
    formPanelProps: ChildFormPanelProps;
    initiallyCollapsed?: boolean;
    title?: React.ReactNode;
  }) => {
    const displayForm = shouldDisplayForm(fields);

    if (!displayForm && !formPanelProps?.renderFooter && !formPanelProps?.renderHeader) {
      return null;
    }

    return (
      <FormPanel
        title={formTitle}
        fields={fields}
        {...formPanelProps}
        initiallyCollapsed={formInitiallyCollapsed ?? formPanelProps.initiallyCollapsed}
      />
    );
  };

  const formPanelProps: ChildFormPanelProps = {
    access,
    disabled,
    features,
    nested,
    additionalFieldProps,
    renderFooter,
    renderHeader,
    highlighted: location?.hash,
    collapsible,
    initiallyCollapsed,
  };

  return (
    <div {...otherProps}>
      {forms?.map((formGroup, i) => (
        <Fragment key={i}>{renderForm({formPanelProps, ...formGroup})}</Fragment>
      ))}
      {typeof forms === 'undefined' &&
        typeof propFields !== 'undefined' &&
        renderForm({fields: propFields, formPanelProps, title})}
    </div>
  );
}

export default withSentryRouter(JsonForm);
