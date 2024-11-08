import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import {Flex} from 'sentry/components/container/flex';
import {IconSentry, IconStar} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

const MONTH_OPTIONS = [
  {value: 'jan', label: 'January'},
  {value: 'feb', label: 'February'},
];

const DAY_OPTIONS = [
  {value: '1', label: '1'},
  {value: '2', label: '2'},
];

const DAIRY_OPTIONS = [
  {value: 'latte', label: 'Vanilla Latte'},
  {value: 'matcha', label: 'Matcha Latte'},
];

const DAIRY_FREE_OPTIONS = [
  {value: 'tea', label: 'Tea'},
  {value: 'espresso', label: 'Espresso'},
];

const MAIN_OPTIONS = [
  {value: 'pasta', label: 'Pasta'},
  {value: 'steak', label: 'Steak'},
];

const SIDE_OPTIONS = [
  {value: 'salad', label: 'Salad'},
  {value: 'potato', label: 'Mashed Potatoes'},
];

const ADJ_OPTIONS = [
  {value: 'cool', label: 'cool'},
  {value: 'funny', label: 'funny'},
  {value: 'awesome', label: 'awesome'},
];

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
              aria-label={'Select an Option'}
              size="sm"
              icon={<IconSentry />}
            >
              Select an Option
            </Button>
          )}
        >
          <CompositeSelect.Region
            label={'Month'}
            value={month}
            onChange={selection => setMonth(selection.value)}
            options={MONTH_OPTIONS}
          />
          <CompositeSelect.Region
            label={'Day'}
            value={day}
            onChange={selection => setDay(selection.value)}
            options={DAY_OPTIONS}
          />
          <CompositeSelect.Region
            label={'I am...'}
            aria-label={'Cool'}
            multiple
            value={adjectives}
            onChange={selection => setAdjectives(selection.map(s => s.value))}
            options={ADJ_OPTIONS}
          />
        </CompositeSelect>
      </Fragment>
    );
  });

  story('Compact vs Composite', () => {
    const [main, setMain] = useState<string>('pasta');
    const [side, setSide] = useState<string>('salad');
    const [drink, setDrink] = useState<string>('matcha');
    const [drinks, setDrinks] = useState<string[]>(['matcha', 'tea']);

    return (
      <Fragment>
        <p>
          See the difference between how <code>CompositeSelect</code> and{' '}
          <code>CompactSelect</code> deal with multiple single-select sections:
        </p>

        <Flex gap={space(1)}>
          <CompositeSelect
            trigger={triggerProps => (
              <Button
                {...triggerProps}
                aria-label={'Composite Select'}
                size="sm"
                icon={<IconSentry />}
              >
                Composite Select Single Select
              </Button>
            )}
          >
            <CompositeSelect.Region
              label={'Mains'}
              value={main}
              onChange={selection => setMain(selection.value)}
              options={MAIN_OPTIONS}
            />
            <CompositeSelect.Region
              label={'Sides'}
              value={side}
              onChange={selection => setSide(selection.value)}
              options={SIDE_OPTIONS}
            />
          </CompositeSelect>

          <CompactSelect
            trigger={triggerProps => (
              <Button
                {...triggerProps}
                aria-label={'Compact Select'}
                size="sm"
                icon={<IconStar />}
              >
                Compact Select Single Select
              </Button>
            )}
            value={drink}
            onChange={selection => setDrink(selection.value)}
            options={[
              {key: 'dairy', label: 'Dairy', options: DAIRY_OPTIONS},
              {key: 'nondairy', label: 'Dairy Free Options', options: DAIRY_FREE_OPTIONS},
            ]}
          />

          <CompactSelect
            multiple
            trigger={triggerProps => (
              <Button
                {...triggerProps}
                aria-label={'Compact Select'}
                size="sm"
                icon={<IconStar />}
              >
                Compact Select Multiple Select
              </Button>
            )}
            value={drinks}
            onChange={selection => setDrinks(selection.map(s => s.value))}
            options={[
              {key: 'dairy', label: 'Dairy', options: DAIRY_OPTIONS},
              {key: 'nondairy', label: 'Dairy Free Options', options: DAIRY_FREE_OPTIONS},
            ]}
          />
        </Flex>
      </Fragment>
    );
  });
});
