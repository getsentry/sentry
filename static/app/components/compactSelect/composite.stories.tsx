import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/button';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(CompositeSelect, story => {
  story('Introduction', () => {
    return (
      <Fragment>
        <p>
          <code>CompositeSelect</code> is a dropdown select component that allows you to
          combine custom select sections and control multi-select for each section.
        </p>

        <p>
          <code>CompactSelect</code> is a similar component, but it does not allow for
          multiple single selects (e.g. checkmark-type selects) in each section, which is
          what <code>CompositeSelect</code> is useful for. We use
          <code>CompositeSelect</code> for features like the Replay speed controller and
          the members filter in organization settings.
        </p>
      </Fragment>
    );
  });

  story('Basics', () => {
    const [month, setMonth] = useState<string>('jan');
    const [day, setDay] = useState<string>('1');
    const [adjectives, setAdjectives] = useState<string[]>(['cool', 'funny']);

    const MONTH_OPTIONS = [
      {value: 'jan', label: 'January'},
      {value: 'feb', label: 'February'},
    ];

    const DAY_OPTIONS = [
      {value: '1', label: '1'},
      {value: '2', label: '2'},
    ];

    const ADJ_OPTIONS = [
      {value: 'cool', label: 'cool'},
      {value: 'funny', label: 'funny'},
      {value: 'awesome', label: 'awesome'},
    ];

    return (
      <Fragment>
        <p>
          The <code>CompositeSelect</code> component is built up of{' '}
          <code>CompositeSelect.Region</code> children. Each of these children acts
          similarly to a basic <code>CompactSelect</code> option, and requires a{' '}
          <code>value</code>, <code>onChange</code> handler, and an array of{' '}
          <code>options</code>.
        </p>
        <CompositeSelect
          trigger={triggerProps => (
            <Button
              {...triggerProps}
              aria-label={t('Sort Flags')}
              size="sm"
              icon={<IconCalendar />}
            >
              Select an Option
            </Button>
          )}
        >
          <CompositeSelect.Region
            label={t('Month')}
            value={month}
            onChange={selection => setMonth(selection.value)}
            options={MONTH_OPTIONS}
          />
          <CompositeSelect.Region
            label={t('Day')}
            value={day}
            onChange={selection => setDay(selection.value)}
            options={DAY_OPTIONS}
          />
          <CompositeSelect.Region
            label={t('I am...')}
            aria-label={t('Cool')}
            multiple
            value={adjectives}
            onChange={selection => {
              setAdjectives(selection.map(s => s.value));
            }}
            options={ADJ_OPTIONS}
          />
        </CompositeSelect>
        <br />
        <br />
        <br />
        <br />
      </Fragment>
    );
  });
});
