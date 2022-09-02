import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';
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
    return tct('[method] because of the PII rule [break][rule-description]', {
      method,
      break: <br />,
      'rule-description': KNOWN_RULES[rule_id],
    });
  }

  // advanced data scrubbing
  const [level, ruleId] = String(rule_id).split(':');

  if (level === 'organization') {
    // if organization is not available, fall back to the default message
    if (!organization) {
      return tct('[method] because of the PII rule [break][rule-description]', {
        method,
        break: <br />,
        'rule-description': rule_id,
      });
    }

    const rules = convertRelayPiiConfig(organization?.relayPiiConfig);
    const rule = rules.find(({id}) => String(id) === ruleId);

    return (
      <Wrapper>
        {tct(
          '[method] because of the PII rule [break][rule-description] in the settings of the organization [break][slug]',
          {
            method,
            break: <br />,
            'rule-description': (
              <RuleDescription>
                <Link
                  to={`/settings/${organization.slug}/security-and-privacy/#advanced-data-scrubbing`}
                >
                  {rule ? getRuleDescription(rule) : ruleId}
                </Link>
              </RuleDescription>
            ),
            slug: (
              <Slug>
                <Link
                  to={`/settings/${organization.slug}/security-and-privacy/#advanced-data-scrubbing`}
                >
                  {organization.slug}
                </Link>
              </Slug>
            ),
          }
        )}
      </Wrapper>
    );
  }

  // if project and organization are not available, fall back to the default message
  if (!project || !organization) {
    return tct('[method] because of the PII rule [break][rule-description]', {
      method,
      break: <br />,
      'rule-description': rule_id,
    });
  }

  const rules = convertRelayPiiConfig(project?.relayPiiConfig);
  const rule = rules.find(({id}) => String(id) === ruleId);

  return tct(
    '[method] because of the PII rule [break][rule-description] in the settings of the project [break][slug]',
    {
      method,
      break: <br />,
      'rule-description': (
        <RuleDescription>
          <Link
            to={`/settings/${organization.slug}/projects/${project.slug}/security-and-privacy/#advanced-data-scrubbing`}
          >
            {rule ? getRuleDescription(rule) : ruleId}
          </Link>
        </RuleDescription>
      ),
      slug: (
        <Slug>
          <Link
            to={`/settings/${organization.slug}/projects/${project?.slug}/security-and-privacy/#advanced-data-scrubbing`}
          >
            {project.slug}
          </Link>
        </Slug>
      ),
    }
  );
}

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(0.5)};
`;

const RuleDescription = styled('div')`
  margin: ${space(0.5)} 0;
`;

const Slug = styled('div')`
  margin-top: ${space(0.5)};
`;
