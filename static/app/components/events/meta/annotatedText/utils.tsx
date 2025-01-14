import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {tct} from 'sentry/locale';
import type {ChunkType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
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

export function getTooltipText({
  remark = '',
  rule_id = '',
  organization,
  project,
}: Pick<ChunkType, 'remark' | 'rule_id'> & {
  organization?: Organization;
  project?: Project;
}) {
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const method = REMARKS[remark];

  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  if (NON_DATA_SCRUBBING_RULES[rule_id]) {
    return tct('[method] because of [ruleDescription]', {
      method,
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
