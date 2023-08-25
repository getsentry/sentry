import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {tct} from 'sentry/locale';
import {ChunkType, Meta, Organization, Project} from 'sentry/types';
import {convertRelayPiiConfig} from 'sentry/views/settings/components/dataScrubbing/convertRelayPiiConfig';
import {getRuleDescription} from 'sentry/views/settings/components/dataScrubbing/utils';

const REMARKS = {
  a: 'Annotated',
  x: 'Removed',
  s: 'Replaced',
  m: 'Masked',
  p: 'Pseudonymized',
  e: 'Encrypted',
};

const NON_DATA_SCRUBBING_RULES = {
  '!limit': 'size limits',
  '!raw': 'raw payload',
  '!config': 'SDK configuration',
};

export const REMOVED_SIZE_LIMIT_CONTAINER_INFO = {
  array: {
    container: 'Collection',
    items: 'items',
  },
  string: {
    container: 'Serialized object',
    items: 'characters',
  },
  object: {
    container: 'Mapping',
    items: 'items',
  },
} satisfies {[containerType: string]: {container: string; items: string}};

const REMOVED_SIZE_LIMIT_INDICATOR = {rule_id: '!limit', remark: 'x'} satisfies {
  remark: keyof typeof REMARKS;
  rule_id: keyof typeof NON_DATA_SCRUBBING_RULES;
};

export function getRemovedForSizeLimitTooltipText(
  container: keyof typeof REMOVED_SIZE_LIMIT_CONTAINER_INFO,
  length: number
) {
  return tct(
    '[method] because of [ruleDescription]. [container] has [length] [items] total.',
    {
      method: REMARKS[REMOVED_SIZE_LIMIT_INDICATOR.remark],
      container: REMOVED_SIZE_LIMIT_CONTAINER_INFO[container].container,
      items: REMOVED_SIZE_LIMIT_CONTAINER_INFO[container].items,
      ruleDescription: NON_DATA_SCRUBBING_RULES[REMOVED_SIZE_LIMIT_INDICATOR.rule_id],
      length,
    }
  );
}

export function getTooltipText({
  remark = '',
  rule_id = '',
  organization,
  project,
  meta,
}: Pick<ChunkType, 'remark' | 'rule_id'> & {
  meta: Meta;
  organization?: Organization;
  project?: Project;
}) {
  const method = REMARKS[remark];

  if (NON_DATA_SCRUBBING_RULES[rule_id]) {
    if (
      rule_id === REMOVED_SIZE_LIMIT_INDICATOR.rule_id &&
      remark === REMOVED_SIZE_LIMIT_INDICATOR.remark &&
      meta?.len
    ) {
      return getRemovedForSizeLimitTooltipText('string', meta.len);
    }
    return tct('[method] because of [ruleDescription]', {
      method,
      ruleDescription: NON_DATA_SCRUBBING_RULES[rule_id],
    });
  }

  // advanced data scrubbing
  const [level, ruleId] = String(rule_id).split(':');

  if (level === 'organization') {
    // if organization is not available, fall back to the default message
    if (!organization) {
      return (
        <Wrapper>
          {tct(
            "[method] because of the a data scrubbing rule in your organization's settings.",
            {
              method,
            }
          )}
        </Wrapper>
      );
    }

    const rules = convertRelayPiiConfig(organization?.relayPiiConfig);
    const rule = rules.find(({id}) => String(id) === ruleId);

    return (
      <Wrapper>
        {rule
          ? tct(
              "[method] because of the data scrubbing rule [ruleDescription] in your [orgSettingsLink:organization's settings]",
              {
                method,
                ruleDescription: (
                  <Link
                    to={`/settings/${organization.slug}/security-and-privacy/advanced-data-scrubbing/${ruleId}/`}
                  >
                    {rule ? getRuleDescription(rule) : ruleId}
                  </Link>
                ),
                orgSettingsLink: (
                  <Link to={`/settings/${organization.slug}/security-and-privacy/`}>
                    {organization.slug}
                  </Link>
                ),
              }
            )
          : tct(
              "[method] because of a data scrubbing rule in your [orgSettingsLink:organization's settings]",
              {
                method,
                orgSettingsLink: (
                  <Link to={`/settings/${organization.slug}/security-and-privacy/`}>
                    {organization.slug}
                  </Link>
                ),
              }
            )}
      </Wrapper>
    );
  }

  // if project and organization are not available, fall back to the default message
  if (!project || !organization) {
    return (
      <Wrapper>
        {tct("[method] because of a data scrubbing rule in your project's settings", {
          method,
        })}
      </Wrapper>
    );
  }

  const rules = convertRelayPiiConfig(project?.relayPiiConfig);
  const rule = rules.find(({id}) => String(id) === ruleId);

  return (
    <Wrapper>
      {rule
        ? tct(
            '[method] because of the data scrubbing rule [ruleDescription] in the settings of the project [projectSlug]',
            {
              method,
              ruleDescription: (
                <Link
                  to={`/settings/${organization.slug}/projects/${project.slug}/security-and-privacy/advanced-data-scrubbing/${ruleId}/`}
                >
                  {rule ? getRuleDescription(rule) : ruleId}
                </Link>
              ),
              projectSlug: (
                <Link
                  to={`/settings/${organization.slug}/projects/${project?.slug}/security-and-privacy/`}
                >
                  {project.slug}
                </Link>
              ),
            }
          )
        : tct(
            '[method] because of a data scrubbing rule in the settings of the project [projectSlug]',
            {
              method,
              projectSlug: (
                <Link
                  to={`/settings/${organization.slug}/projects/${project?.slug}/security-and-privacy/`}
                >
                  {project.slug}
                </Link>
              ),
            }
          )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  line-height: ${p => p.theme.text.lineHeightBody};
`;
