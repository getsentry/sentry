import {Fragment, useEffect} from 'react';

import {defined} from 'sentry/utils/defined';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';
import {useLocation} from 'sentry/utils/useLocation';

import type {FormPanelProps} from './formPanel';
import {FormPanel} from './formPanel';
import type {Field, FieldObject, JsonFormObject} from './types';

interface JsonFormProps extends Omit<FormPanelProps, 'highlighted' | 'fields'> {
  /**
   * If `forms` is not defined, `title` + `fields` must be required.
   * Allows more fine grain control of title/fields
   */
  fields?: FieldObject[];

  /**
   * Fields that are grouped by "section"
   */
  forms?: JsonFormObject[];
}

function JsonForm({
  access,
  collapsible,
  initiallyCollapsed = false,
  fields: propFields,
  title,
  forms,
  disabled,
  features,
  renderFooter,
  renderHeader,
  ...otherProps
}: JsonFormProps) {
  const location = useLocation();

  const scrollToHash = (hash?: string): void => {
    if (!hash) {
      return;
    }

    const element = document.getElementById(
      sanitizeQuerySelector(decodeURIComponent(hash.slice(1)))
    );
    if (!element) {
      return;
    }

    const {top, height} = element.getBoundingClientRect();
    window.scrollTo({
      behavior: 'smooth',
      top: window.scrollY + top - (window.innerHeight - height) / 2 - 100,
    });
  };

  useEffect(() => {
    // Let parent route effects finish, including the scroll-to-top behavior.
    const animationFrame = window.requestAnimationFrame(() => {
      scrollToHash(location?.hash);
    });

    return () => window.cancelAnimationFrame(animationFrame);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
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
            title,
            forms,
            disabled,
            features,
            renderFooter,
            renderHeader,
            ...otherProps,
          });
        }
        return !field.visible;
      });

      return !areAllFieldsHidden;
    }

    return true;
  };

  const formPanelProps: ChildFormPanelProps = {
    access,
    disabled,
    features,
    renderFooter,
    renderHeader,
    highlighted: location?.hash,
    collapsible,
    initiallyCollapsed,
  };

  const formGroups = forms?.map((formGroup, i) => {
    const displayForm = shouldDisplayForm(formGroup.fields);
    if (!displayForm && !formPanelProps.renderFooter && !formPanelProps.renderHeader) {
      return null;
    }

    return (
      <Fragment key={i}>
        <FormPanel
          title={formGroup.title}
          fields={formGroup.fields}
          {...formPanelProps}
          initiallyCollapsed={formPanelProps.initiallyCollapsed}
        />
      </Fragment>
    );
  });

  const shouldRenderSingleForm =
    forms === undefined &&
    propFields !== undefined &&
    (shouldDisplayForm(propFields) ||
      !!formPanelProps.renderFooter ||
      !!formPanelProps.renderHeader);
  const singleForm = shouldRenderSingleForm ? (
    <FormPanel
      title={title}
      fields={propFields}
      {...formPanelProps}
      initiallyCollapsed={formPanelProps.initiallyCollapsed}
    />
  ) : null;

  return (
    <div {...otherProps}>
      {formGroups}
      {singleForm}
    </div>
  );
}

interface ChildFormPanelProps extends Pick<
  FormPanelProps,
  | 'access'
  | 'disabled'
  | 'features'
  | 'renderFooter'
  | 'renderHeader'
  | 'initiallyCollapsed'
  | 'collapsible'
> {
  highlighted?: string;
}

// eslint-disable-next-line @sentry/no-default-exports
export default JsonForm;
