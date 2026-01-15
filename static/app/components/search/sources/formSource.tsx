import {useCallback, useEffect, useMemo, useState} from 'react';

import type {Field, FieldObject, JsonFormObject} from 'sentry/components/forms/types';
// Import all form definitions
import accountDetailsForm, {
  route as accountDetailsRoute,
  createAccountDetailsForm,
  type FormSearchContext,
} from 'sentry/data/forms/accountDetails';
import accountEmailsForm, {
  route as accountEmailsRoute,
} from 'sentry/data/forms/accountEmails';
import {
  fields as accountNotificationSettingsFields,
  route as accountNotificationSettingsRoute,
} from 'sentry/data/forms/accountNotificationSettings';
import accountPasswordForm, {
  route as accountPasswordRoute,
} from 'sentry/data/forms/accountPassword';
import accountPreferencesForm, {
  route as accountPreferencesRoute,
} from 'sentry/data/forms/accountPreferences';
import cspReportsForm, {route as cspReportsRoute} from 'sentry/data/forms/cspReports';
import inboundFiltersForm, {
  route as inboundFiltersRoute,
} from 'sentry/data/forms/inboundFilters';
import organizationGeneralSettingsForm, {
  createOrganizationGeneralSettingsForm,
  route as organizationGeneralSettingsRoute,
} from 'sentry/data/forms/organizationGeneralSettings';
import organizationMembershipSettingsForm, {
  route as organizationMembershipSettingsRoute,
} from 'sentry/data/forms/organizationMembershipSettings';
import organizationSecurityAndPrivacyGroupsForm, {
  route as organizationSecurityAndPrivacyGroupsRoute,
} from 'sentry/data/forms/organizationSecurityAndPrivacyGroups';
import {
  fields as projectAlertsFields,
  route as projectAlertsRoute,
} from 'sentry/data/forms/projectAlerts';
import {
  fields as projectGeneralSettingsFields,
  route as projectGeneralSettingsRoute,
} from 'sentry/data/forms/projectGeneralSettings';
import {
  fields as projectIssueGroupingFields,
  route as projectIssueGroupingRoute,
} from 'sentry/data/forms/projectIssueGrouping';
import projectSecurityAndPrivacyGroupsForm, {
  route as projectSecurityAndPrivacyGroupsRoute,
} from 'sentry/data/forms/projectSecurityAndPrivacyGroups';
import userFeedbackForm, {
  route as userFeedbackRoute,
} from 'sentry/data/forms/userFeedback';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

import type {ChildProps, Result, ResultItem} from './types';
import {makeResolvedTs, strGetFn} from './utils';

export type FormSearchField = {
  description: React.ReactNode;
  field: FieldObject;
  route: string;
  title: React.ReactNode;
};

type SearchMapParams = {
  fields: Record<string, Field>;
  formGroups: readonly JsonFormObject[];
  route: string;
};

/**
 * Creates a list of objects to be injected by a search source
 *
 * @param route The route a form field belongs on
 * @param formGroups An array of `FormGroup: {title: string, fields: [Field]}`
 * @param fields An object whose key is field name and value is a `Field`
 */
function createSearchMap({
  route,
  formGroups,
  fields,
  ...other
}: SearchMapParams): FormSearchField[] {
  // There are currently two ways to define forms (TODO(billy): Turn this into one):
  // If `formGroups` is defined, then return a flattened list of fields in all formGroups
  // Otherwise `fields` is a map of fieldName -> fieldObject -- create a list of fields
  const listOfFields = formGroups
    ? formGroups.flatMap(formGroup => formGroup.fields)
    : Object.keys(fields).map(fieldName => fields[fieldName]);

  return listOfFields.map<FormSearchField>(field => ({
    ...other,
    route,
    title: typeof field === 'function' ? undefined : (field?.label as string),
    description: typeof field === 'function' ? undefined : (field?.help as string),
    field: field!,
  }));
}

type FormDefinition = {
  route: string;
  factoryFn?: (context: FormSearchContext) => readonly JsonFormObject[];
  fields?: Record<string, Field>;
  formGroups?: readonly JsonFormObject[];
};

/**
 * Registry of all form definitions. Forms with factory functions will be invoked
 * with FormSearchContext at runtime to get dynamic field definitions.
 */
const FORM_REGISTRY: FormDefinition[] = [
  {
    route: accountDetailsRoute,
    formGroups: accountDetailsForm,
    factoryFn: createAccountDetailsForm,
  },
  {
    route: accountEmailsRoute,
    formGroups: accountEmailsForm,
  },
  {
    route: accountNotificationSettingsRoute,
    formGroups: [],
    fields: accountNotificationSettingsFields as Record<string, Field>,
  },
  {
    route: accountPasswordRoute,
    formGroups: accountPasswordForm,
  },
  {
    route: accountPreferencesRoute,
    formGroups: accountPreferencesForm,
  },
  {
    route: cspReportsRoute,
    formGroups: cspReportsForm,
  },
  {
    route: inboundFiltersRoute,
    formGroups: inboundFiltersForm,
  },
  {
    route: organizationGeneralSettingsRoute,
    formGroups: organizationGeneralSettingsForm,
    factoryFn: createOrganizationGeneralSettingsForm,
  },
  {
    route: organizationMembershipSettingsRoute,
    formGroups: organizationMembershipSettingsForm,
  },
  {
    route: organizationSecurityAndPrivacyGroupsRoute,
    formGroups: organizationSecurityAndPrivacyGroupsForm,
  },
  {
    route: projectAlertsRoute,
    formGroups: [],
    fields: projectAlertsFields as Record<string, Field>,
  },
  {
    route: projectGeneralSettingsRoute,
    formGroups: [],
    fields: projectGeneralSettingsFields as Record<string, Field>,
  },
  {
    route: projectIssueGroupingRoute,
    formGroups: [],
    fields: projectIssueGroupingFields as Record<string, Field>,
  },
  {
    route: projectSecurityAndPrivacyGroupsRoute,
    formGroups: projectSecurityAndPrivacyGroupsForm,
  },
  {
    route: userFeedbackRoute,
    formGroups: userFeedbackForm,
  },
];

/**
 * Gets a list of all form fields. For forms using the factory pattern and dynamic fields,
 * invokes the factory function with runtime context to get the full form definition for search.
 */
function getSearchMap(searchContext: FormSearchContext): FormSearchField[] {
  const allFormFields: FormSearchField[] = FORM_REGISTRY.flatMap(formDef => {
    let formGroups = formDef.formGroups ?? [];

    // If the form has a factory function, invoke it to get dynamic fields
    if (formDef.factoryFn) {
      try {
        formGroups = formDef.factoryFn(searchContext);
      } catch {
        // If factory invocation fails, fall back to static form groups
        formGroups = formDef.formGroups ?? [];
      }
    }

    try {
      const searchMap = createSearchMap({
        formGroups,
        fields: formDef.fields ?? {},
        route: formDef.route,
      });

      return searchMap ?? [];
    } catch {
      // If createSearchMap fails, skip this form
      return [];
    }
  });

  return allFormFields;
}

interface Props {
  children: (props: ChildProps) => React.ReactElement;
  /**
   * search term
   */
  query: string;
  /**
   * fusejs options.
   */
  searchOptions?: Fuse.IFuseOptions<FormSearchField>;
}

function FormSource({searchOptions, query, children}: Props) {
  const [fuzzy, setFuzzy] = useState<Fuse<FormSearchField> | null>(null);
  const user = useUser();
  const organization = useOrganization({allowNull: true});

  // Build search context from current runtime state
  const searchContext: FormSearchContext = useMemo(
    () => ({
      user,
      organization,
      access: new Set(organization?.access ?? []),
      team: null, // Global search context is not team-specific
    }),
    [user, organization]
  );

  const createSearch = useCallback(async () => {
    setFuzzy(
      await createFuzzySearch(getSearchMap(searchContext), {
        ...searchOptions,
        keys: ['title', 'description'],
        getFn: strGetFn,
      })
    );
  }, [searchOptions, searchContext]);

  useEffect(() => void createSearch(), [createSearch]);

  const results = useMemo(() => {
    const resolvedTs = makeResolvedTs();
    return (
      fuzzy?.search(query).map<Result>(({item, ...rest}) => ({
        item: {
          ...item,
          sourceType: 'field',
          resultType: 'field',
          to: {pathname: item.route, hash: `#${encodeURIComponent(item.field.name)}`},
          resolvedTs,
        } as ResultItem,
        ...rest,
      })) ?? []
    );
  }, [fuzzy, query]);

  return children({
    isLoading: fuzzy === null,
    results,
  });
}

export default FormSource;
