import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';

import {AiPrivacyNotice} from 'sentry/components/aiPrivacyTooltip';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {IconSeer} from 'sentry/icons/iconSeer';
import {IconSettings} from 'sentry/icons/iconSettings';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';

interface SeerDrawerNavigatorProps {
  project: Project;
  onCopyMarkdown?: () => void;
  onReset?: () => void;
  showCopyMarkdown?: boolean;
  showReset?: boolean;
}

export function SeerDrawerNavigator({
  project,
  onCopyMarkdown,
  onReset,
  showCopyMarkdown = true,
  showReset = true,
}: SeerDrawerNavigatorProps) {
  const organization = useOrganization();

  return (
    <Flex
      align="center"
      justify="between"
      padding="sm 2xl"
      background="primary"
      minHeight={`${MIN_NAV_HEIGHT}px`}
      borderBottom="muted"
    >
      <Flex align="center" gap="md">
        <IconSeer animation={undefined} size="md" />
        <Heading as="h3" size="xl">
          {t('Seer')}
        </Heading>
        <QuestionTooltip
          isHoverable
          title={
            <Flex direction="column" gap="md">
              <div>
                <AiPrivacyNotice />
              </div>
              <div>
                {tct('Seer can be turned off in [settingsDocs:Settings].', {
                  settingsDocs: (
                    <Link
                      to={{
                        pathname: `/settings/${organization.slug}/`,
                        hash: 'hideAiFeatures',
                      }}
                    />
                  ),
                })}
              </div>
            </Flex>
          }
          size="sm"
        />
      </Flex>
      <Flex align="center" gap="md">
        {showReset && (
          <Button
            size="xs"
            icon={<IconRefresh />}
            onClick={onReset}
            disabled={!onReset}
            aria-label={t('Start a new analysis from scratch')}
            tooltipProps={{title: t('Start a new analysis from scratch')}}
          />
        )}
        {showCopyMarkdown && (
          <Button
            size="xs"
            icon={<IconCopy />}
            onClick={onCopyMarkdown}
            disabled={!onCopyMarkdown}
            tooltipProps={{title: t('Copy analysis as Markdown / LLM prompt')}}
            aria-label={t('Copy analysis as Markdown')}
          />
        )}
        <LinkButton
          external
          href={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
          size="xs"
          tooltipProps={{title: t('Project Settings for Seer')}}
          aria-label={t('Project Settings for Seer')}
          icon={<IconSettings />}
        />
        <AutofixFeedback iconOnly />
      </Flex>
    </Flex>
  );
}
