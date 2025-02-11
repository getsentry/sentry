import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {createFilter} from 'sentry/components/forms/controls/reactSelectWrapper';
import type {Field} from 'sentry/components/forms/types';
import platforms from 'sentry/data/platforms';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {convertMultilineFieldValue, extractMultilineFields} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import slugify from 'sentry/utils/slugify';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/';

const getResolveAgeAllowedValues = () => {
  let i = 0;
  const values: number[] = [];
  while (i <= 720) {
    values.push(i);
    if (i < 12) {
      i += 1;
    } else if (i < 24) {
      i += 3;
    } else if (i < 36) {
      i += 6;
    } else if (i < 48) {
      i += 12;
    } else {
      i += 24;
    }
  }
  return values;
};

const RESOLVE_AGE_ALLOWED_VALUES = getResolveAgeAllowedValues();

const ORG_DISABLED_REASON = t(
  "This option is enforced by your organization's settings and cannot be customized per-project."
);

const PlatformWrapper = styled('div')`
  display: flex;
  align-items: center;
`;
const StyledPlatformIcon = styled(PlatformIcon)`
  margin-right: ${space(1)};
`;

export const fields: Record<string, Field> = {
  name: {
    name: 'name',
    type: 'string',
    required: true,
    label: t('Name'),
    placeholder: t('my-awesome-project'),
    help: t('A name for this project'),
    transformInput: slugify,
    getData: (data: {name?: string}) => {
      return {
        name: data.name,
        slug: data.name,
      };
    },

    saveOnBlur: false,
    saveMessageAlertType: 'warning',
    saveMessage: t(
      "Changing a project's name will also change the project slug. This can break your build scripts! Please proceed carefully."
    ),
  },

  platform: {
    name: 'platform',
    type: 'select',
    label: t('Platform'),
    options: platforms.map(({id, name}) => ({
      value: id,
      label: (
        <PlatformWrapper key={id}>
          <StyledPlatformIcon platform={id} />
          {name}
        </PlatformWrapper>
      ),
    })),
    help: t('The primary platform for this project'),
    filterOption: createFilter({
      stringify: option => {
        const matchedPlatform = platforms.find(({id}) => id === option.value);
        return `${matchedPlatform?.name} ${option.value}`;
      },
    }),
  },
  subjectPrefix: {
    name: 'subjectPrefix',
    type: 'string',
    label: t('Subject Prefix'),
    placeholder: t('e.g. [my-org]'),
    help: t('Choose a custom prefix for emails from this project'),
  },

  resolveAge: {
    name: 'resolveAge',
    type: 'range',
    allowedValues: RESOLVE_AGE_ALLOWED_VALUES,
    label: t('Auto Resolve'),
    help: t(
      "Automatically resolve an issue if it hasn't been seen for this amount of time"
    ),
    formatLabel: val => {
      val = Number(val);
      if (val === 0) {
        return t('Disabled');
      }

      if (val > 23 && val % 24 === 0) {
        // Based on allowed values, val % 24 should always be true
        val = val / 24;
        return tn('%s day', '%s days', val);
      }

      return tn('%s hour', '%s hours', val);
    },
    saveOnBlur: false,
    saveMessage: tct(
      '[strong:Caution]: Enabling auto resolve will immediately resolve anything that has not been seen within this period of time. There is no undo!',
      {
        strong: <strong />,
      }
    ),
    saveMessageAlertType: 'warning',
  },
  allowedDomains: {
    name: 'allowedDomains',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,
    placeholder: t('https://example.com or example.com'),
    label: t('Allowed Domains'),
    help: t(
      'Examples: https://example.com, *, *.example.com, *:80. Separate multiple entries with a newline'
    ),
    getValue: val => extractMultilineFields(val),
    setValue: val => convertMultilineFieldValue(val),
  },
  scrapeJavaScript: {
    name: 'scrapeJavaScript',
    type: 'boolean',
    // if this is off for the organization, it cannot be enabled for the project
    disabled: ({organization, project, name}) =>
      !organization[name] || !hasEveryAccess(['project:write'], {organization, project}),
    disabledReason: ORG_DISABLED_REASON,
    // `props` are the props given to FormField
    setValue: (val, props) => props.organization?.[props.name] && val,
    label: t('Enable JavaScript source fetching'),
    help: t('Allow Sentry to scrape missing JavaScript source context when possible'),
  },
  securityToken: {
    name: 'securityToken',
    type: 'string',
    label: t('Security Token'),
    help: t(
      'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'
    ),
    setValue: value => getDynamicText({value, fixed: '__SECURITY_TOKEN__'}),
  },
  securityTokenHeader: {
    name: 'securityTokenHeader',
    type: 'string',
    placeholder: t('X-Sentry-Token'),
    label: t('Security Token Header'),
    help: t(
      'Outbound requests matching Allowed Domains will have the header "{token_header}: {token}" appended'
    ),
  },
  verifySSL: {
    name: 'verifySSL',
    type: 'boolean',
    label: t('Verify TLS/SSL'),
    help: t('Outbound requests will verify TLS (sometimes known as SSL) connections'),
  },
};
