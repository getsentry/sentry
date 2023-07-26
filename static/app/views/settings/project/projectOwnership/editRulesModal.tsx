import {Fragment} from 'react';
import styled from '@emotion/styled';

import {EditOwnershipRulesModalOptions} from 'sentry/actionCreators/modal';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import OwnerInput from 'sentry/views/settings/project/projectOwnership/ownerInput';

interface EditOwnershipRulesModalProps extends EditOwnershipRulesModalOptions {
  onCancel: () => void;
}

export function EditOwnershipRules({ownership, ...props}: EditOwnershipRulesModalProps) {
  const hasStreamlineTargetingFeature = props.organization.features.includes(
    'streamline-targeting-context'
  );
  const email = ConfigStore.get('user')?.email ?? '#team-slug';

  return (
    <Fragment>
      {hasStreamlineTargetingFeature ? (
        <Fragment>
          <Description>
            {tct(
              'Assign issues based on custom rules. To learn more, [docs:read the docs].',
              {
                docs: (
                  <ExternalLink href="https://docs.sentry.io/product/issues/issue-owners/" />
                ),
              }
            )}
          </Description>
          <StyledPre>
            # {t("Here's an example")}
            <br />
            path:src/views/checkout {email}
            <br />
            url:https://example.com/checkout {email}
            <br />
            tags.transaction:/checkout/:page {email}
          </StyledPre>
        </Fragment>
      ) : (
        <Fragment>
          <Block>
            {t('Globbing Syntax')}
            <CodeBlock>
              {'* matches everything\n? matches any single character'}
            </CodeBlock>
          </Block>
          <Block>
            {t('Examples')}
            <CodeBlock>
              path:src/example/pipeline/* person@sentry.io #infra
              {'\n'}
              module:com.module.name.example #sdks
              {'\n'}
              url:http://example.com/settings/* #product #infra
              {'\n'}
              tags.sku_class:enterprise #enterprise
            </CodeBlock>
          </Block>
        </Fragment>
      )}
      {ownership && (
        <OwnerInput
          {...props}
          dateUpdated={ownership.lastUpdated}
          initialText={ownership.raw || ''}
          page="project_settings"
        />
      )}
    </Fragment>
  );
}

const Block = styled(TextBlock)`
  margin-bottom: ${space(2)};
`;

const CodeBlock = styled('pre')`
  word-break: break-all;
  white-space: pre-wrap;
`;

const StyledPre = styled('pre')`
  word-break: break-word;
  padding: ${space(2)};
  line-height: 1.6;
  color: ${p => p.theme.subText};
`;

const Description = styled('p')`
  margin-bottom: ${space(1)};
`;
