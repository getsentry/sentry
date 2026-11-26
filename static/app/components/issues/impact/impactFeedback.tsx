import {useState} from 'react';
import {IconThumb} from '@sentry/icons/thumb';
import {captureFeedback} from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {t, tct} from 'sentry/locale';
import {
  IMPACT_LEVELS,
  type Group,
  type ImpactAssessment,
  type ImpactLevel,
} from 'sentry/types/group';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

import {ImpactIcon} from './impactIcon';
import {getImpactLevelLabel} from './utils';

/**
 * Lets users mark an assessment as right or wrong, with the level it should have had.
 * Sent as user feedback, for building evals, does not mutate the existing impact assessment.
 */
export function ImpactFeedback({
  impact,
  group,
  onCorrectingChange,
}: {
  group: Group;
  impact: ImpactAssessment;
  onCorrectingChange?: (isCorrecting: boolean) => void;
}) {
  const {level, score, runUuid, promptVersion, sourceEventId} = impact;
  // Shared by every surface showing this assessment, so it's only asked once.
  const [submitted, setSubmitted] = useSessionStorage(
    `impact-assessment-feedback:${group.id}:${runUuid ?? sourceEventId}`,
    false
  );
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctedLevel, setCorrectedLevel] = useState<ImpactLevel | null>(null);
  const [note, setNote] = useState('');

  const updateCorrecting = (value: boolean) => {
    setIsCorrecting(value);
    onCorrectingChange?.(value);
  };

  const submit = (verdict: 'positive' | 'negative') => {
    const assessed = `${level} ${score}`;
    const message =
      verdict === 'positive'
        ? `Impact assessment is correct: ${assessed}.`
        : `${
            correctedLevel
              ? `Should be ${correctedLevel} (was ${assessed}).`
              : `Level unchanged (${assessed}).`
          } ${note.trim()}`;
    captureFeedback({
      message,
      source: 'issue_details.impact_assessment.correction',
      tags: {
        'feedback.source': 'issue_details.impact_assessment.correction',
        'impact.verdict': verdict,
        'impact.level': level,
        'impact.score': score,
        'impact.corrected_level': verdict === 'negative' ? correctedLevel : null,
        'impact.run_uuid': runUuid,
        'impact.prompt_version': promptVersion,
        group_id: group.id,
      },
    });
    setSubmitted(true);
    updateCorrecting(false);
  };

  if (submitted) {
    return (
      <Flex gap="xs" wrap="wrap" align="center">
        <Text size="sm" variant="muted">
          {t('Thanks for the feedback!')}
        </Text>
      </Flex>
    );
  }

  if (!isCorrecting) {
    return (
      <Flex gap="xs" wrap="wrap" align="center">
        <Text size="sm" variant="muted">
          {t('Is this assessment correct?')}
        </Text>
        <Button
          size="xs"
          variant="transparent"
          icon={<IconThumb />}
          aria-label={t('Yes, this assessment is correct')}
          onClick={() => submit('positive')}
        />
        <Button
          size="xs"
          variant="transparent"
          icon={<IconThumb direction="down" />}
          aria-label={t('No, this assessment is incorrect')}
          onClick={() => updateCorrecting(true)}
        />
      </Flex>
    );
  }

  return (
    <Stack gap="sm" align="start">
      <CompactSelect
        size="xs"
        value={correctedLevel ?? undefined}
        options={IMPACT_LEVELS.map(value => ({
          value,
          label: getImpactLevelLabel(value),
          leadingItems: <ImpactIcon size="xs" level={value} />,
        }))}
        onChange={option => setCorrectedLevel(option.value)}
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            size="xs"
            icon={correctedLevel ? <ImpactIcon level={correctedLevel} /> : undefined}
          >
            {correctedLevel
              ? tct('Should be [level]', {level: getImpactLevelLabel(correctedLevel)})
              : t('What should the level be?')}
          </OverlayTrigger.Button>
        )}
      />
      <TextArea
        size="xs"
        autosize
        rows={2}
        maxLength={1000}
        value={note}
        onChange={e => setNote(e.target.value)}
        required
        placeholder={t('What did the assessment get wrong?')}
        aria-label={t('What did the assessment get wrong?')}
      />
      <Flex gap="sm" justify="end" width="100%">
        <Button size="xs" onClick={() => updateCorrecting(false)}>
          {t('Cancel')}
        </Button>
        <Button
          size="xs"
          variant="primary"
          disabled={!note.trim()}
          onClick={() => submit('negative')}
        >
          {t('Send')}
        </Button>
      </Flex>
    </Stack>
  );
}
