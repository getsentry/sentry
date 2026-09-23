import {Chip} from '@sentry/scraps/chip';

const SIZES = ['xs', 'sm', 'md'] as const;

describe('Chip', () => {
  it.snapshot.each<(typeof SIZES)[number]>([...SIZES])(
    'query-size-%s',
    size => (
      <div style={{padding: 8}}>
        <Chip size={size} property="browser" operator="is" value="Chrome" />
      </div>
    ),
    size => ({tags: {size, variant: 'query', area: 'core'}})
  );

  it.snapshot.each<(typeof SIZES)[number]>([...SIZES])(
    'readonly-query-size-%s',
    size => (
      <div style={{padding: 8}}>
        <Chip readonly size={size} property="browser" operator="is" value="Chrome" />
      </div>
    ),
    size => ({tags: {size, variant: 'readonly-query', area: 'core'}})
  );

  it.snapshot.each<(typeof SIZES)[number]>([...SIZES])(
    'value-size-%s',
    size => (
      <div style={{padding: 8}}>
        <Chip size={size} value="Chrome" />
      </div>
    ),
    size => ({tags: {size, variant: 'value', area: 'core'}})
  );

  it.snapshot(
    'query-dismissable',
    () => (
      <div style={{padding: 8}}>
        <Chip property="browser" operator="is" value="Chrome" onDismiss={() => {}} />
      </div>
    ),
    {tags: {variant: 'query', dismissable: 'true', area: 'core'}}
  );

  it.snapshot(
    'value-dismissable',
    () => (
      <div style={{padding: 8}}>
        <Chip value="Chrome" onDismiss={() => {}} />
      </div>
    ),
    {tags: {variant: 'value', dismissable: 'true', area: 'core'}}
  );

  it.snapshot(
    'interactive-sections',
    () => (
      <div style={{padding: 8}}>
        <Chip.Root size="sm">
          <Chip.Property onClick={() => {}}>browser</Chip.Property>
          <Chip.Operator onClick={() => {}}>is</Chip.Operator>
          <Chip.Value onClick={() => {}}>Chrome</Chip.Value>
          <Chip.Dismiss onClick={() => {}} />
        </Chip.Root>
      </div>
    ),
    {tags: {variant: 'query', interactive: 'true', area: 'core'}}
  );

  it.snapshot(
    'interactive-section-hover',
    () => (
      <div style={{padding: 8}}>
        <Chip.Root size="sm">
          <Chip.Property onClick={() => {}}>browser</Chip.Property>
          <Chip.Operator onClick={() => {}}>is</Chip.Operator>
          <Chip.Value onClick={() => {}}>Chrome</Chip.Value>
          <Chip.Dismiss onClick={() => {}} />
        </Chip.Root>
      </div>
    ),
    {
      tags: {variant: 'query', interactive: 'true', state: 'hover', area: 'core'},
      interaction: {hover: '[data-chip-interactive]'},
    }
  );

  it.snapshot(
    'interactive-section-active',
    () => (
      <div style={{padding: 8}}>
        <Chip.Root size="sm">
          <Chip.Property onClick={() => {}}>browser</Chip.Property>
          <Chip.Operator onClick={() => {}}>is</Chip.Operator>
          <Chip.Value onClick={() => {}}>Chrome</Chip.Value>
          <Chip.Dismiss onClick={() => {}} />
        </Chip.Root>
      </div>
    ),
    {
      tags: {variant: 'query', interactive: 'true', state: 'active', area: 'core'},
      interaction: {active: '[data-chip-interactive]'},
    }
  );

  it.snapshot(
    'dismiss-hover',
    () => (
      <div style={{padding: 8}}>
        <Chip value="Chrome" onDismiss={() => {}} />
      </div>
    ),
    {
      tags: {variant: 'value', dismissable: 'true', state: 'hover', area: 'core'},
      interaction: {hover: '[data-chip-dismiss]'},
    }
  );
});
