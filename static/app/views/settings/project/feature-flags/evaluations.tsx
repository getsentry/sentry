import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import NotAvailable from 'sentry/components/notAvailable';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import {IconEllipsis} from 'sentry/icons';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FeatureFlagEvaluation} from 'sentry/types/featureFlags';
import {defined} from 'sentry/utils';

import {rateToPercentage} from '../server-side-sampling/utils';

type Props = {
  evaluations: FeatureFlagEvaluation[];
  onDeleteSegment: (index: number) => void;
  onEditSegment: (index: number) => void;
};

export function Evaluations({evaluations, onDeleteSegment, onEditSegment}: Props) {
  return (
    <Wrapper>
      <EvaluationsPanelHeader>
        <EvaluationsLayout>
          <Column />
          <TypeColumn>{t('Type')}</TypeColumn>
          <TagsColumn>{t('Tags')}</TagsColumn>
          <ResultColumn>{t('Result')}</ResultColumn>
          <RolloutColumn>{t('Rollout')}</RolloutColumn>
          <ActionsColumn />
        </EvaluationsLayout>
      </EvaluationsPanelHeader>
      <PanelBody>
        {evaluations.map((evaluation, index) => (
          <EvaluationsLayout key={index} isContent>
            <Column>
              <IconGrabbableWrapper>
                <IconGrabbable />
              </IconGrabbableWrapper>
            </Column>
            <TypeColumn>
              <Type>{evaluation.type === 'match' ? t('Match') : t('Rollout')}</Type>
            </TypeColumn>
            <TagsColumn>
              {!!evaluation.tags ? (
                <Tags>
                  {Object.keys(evaluation.tags).map(tag => (
                    <Tag key={tag} name={tag} value={evaluation.tags?.[tag]} />
                  ))}
                </Tags>
              ) : (
                <NotAvailable />
              )}
            </TagsColumn>
            <ResultColumn>test</ResultColumn>
            <RolloutColumn>
              {evaluation.type === 'rollout' && defined(evaluation.percentage)
                ? `${rateToPercentage(evaluation.percentage)}%`
                : `100%`}
            </RolloutColumn>
            <ActionsColumn>
              <DropdownMenuControl
                items={[
                  {
                    key: 'feature-flag-edit',
                    label: t('Edit'),
                    onAction: () => onEditSegment(index),
                  },
                  {
                    key: 'feature-flag-delete',
                    label: t('Delete'),
                    priority: 'danger',
                    onAction: () => {
                      openConfirmModal({
                        message: t('Are you sure you want to delete this segment?'),
                        priority: 'danger',
                        onConfirm: () => onDeleteSegment(index),
                      });
                    },
                  },
                ]}
                trigger={({props: triggerProps, ref: triggerRef}) => (
                  <Button
                    ref={triggerRef}
                    {...triggerProps}
                    aria-label={t('Actions')}
                    size="xs"
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();

                      triggerProps.onClick?.(e);
                    }}
                    icon={<IconEllipsis direction="down" size="sm" />}
                  />
                )}
                placement="bottom right"
                offset={4}
              />
            </ActionsColumn>
          </EvaluationsLayout>
        ))}
      </PanelBody>
    </Wrapper>
  );
}

const EvaluationsPanelHeader = styled(PanelHeader)`
  padding: ${space(0.5)} 0;
`;

const EvaluationsLayout = styled('div')<{isContent?: boolean}>`
  width: 100%;
  display: grid;
  grid-template-columns: 90px 1fr 74px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 48px 90px 1fr 0.5fr 90px 74px;
  }

  ${p =>
    p.isContent &&
    css`
      > * {
        line-height: 34px;
      }
      :not(:last-child) {
        border-bottom: 1px solid ${p.theme.border};
      }
    `}
`;

const Column = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
  cursor: default;
  white-space: pre-wrap;
  word-break: break-all;
`;

const TypeColumn = styled(Column)`
  text-align: left;
`;

const TagsColumn = styled(Column)`
  align-items: center;
`;

const RolloutColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;

const ResultColumn = styled(Column)`
  text-align: right;
  justify-content: flex-end;
`;

const Type = styled('div')`
  color: ${p => p.theme.active};
`;

const Wrapper = styled(Panel)`
  border: none;
  margin-bottom: 0;
`;

const IconGrabbableWrapper = styled('div')`
  outline: none;
  display: flex;
  align-items: center;
  height: 34px;
`;

const Tags = styled(Pills)`
  display: flex;
  gap: ${space(1)};
`;

const Tag = styled(Pill)`
  margin-bottom: 0;
`;
