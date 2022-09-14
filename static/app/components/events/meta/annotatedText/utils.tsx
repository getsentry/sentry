import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {tct} from 'sentry/locale';
import {ChunkType, Organization, Project} from 'sentry/types';
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

const KNOWN_RULES = {
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
  const method = REMARKS[remark];

  // default data scrubbing
  if (KNOWN_RULES[rule_id]) {
    return tct('[method] because of the PII rule [ruleDescription]', {
      method,
      ruleDescription: KNOWN_RULES[rule_id],
    });
  }

  // advanced data scrubbing
  const [level, ruleId] = String(rule_id).split(':');

  if (level === 'organization') {
    // if organization is not available, fall back to the default message
    if (!organization) {
      return (
        <Wrapper>
          {tct('[method] because of the PII rule [ruleDescription]', {
            method,
            ruleDescription: rule_id,
          })}
        </Wrapper>
      );
    }

    const rules = convertRelayPiiConfig(organization?.relayPiiConfig);
    const rule = rules.find(({id}) => String(id) === ruleId);

    return (
      <Wrapper>
        {tct(
          '[method] because of the PII rule [ruleDescription] in the settings of the organization [organizationSlug]',
          {
            method,
            ruleDescription: (
              <Link
                to={`/settings/${organization.slug}/security-and-privacy/advanced-data-scrubbing/${ruleId}/`}
              >
                {rule ? getRuleDescription(rule) : ruleId}
              </Link>
            ),
            organizationSlug: (
              <Link to={`/settings/${organization.slug}/`}>{organization.slug}</Link>
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
        {tct('[method] because of the PII rule [ruleDescription]', {
          method,
          ruleDescription: rule_id,
        })}
      </Wrapper>
    );
  }

  const rules = convertRelayPiiConfig(project?.relayPiiConfig);
  const rule = rules.find(({id}) => String(id) === ruleId);

  return (
    <Wrapper>
      {tct(
        '[method] because of the PII rule [ruleDescription] in the settings of the project [projectSlug]',
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
            <Link to={`/settings/${organization.slug}/projects/${project?.slug}/`}>
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
