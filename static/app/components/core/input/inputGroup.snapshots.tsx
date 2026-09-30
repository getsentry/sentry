import type {SnapshotInteraction} from 'sentry-test/snapshots/snapshot';

import {Button} from '@sentry/scraps/button';
import {Chip} from '@sentry/scraps/chip';
import {InputGroup} from '@sentry/scraps/input';
import type {InputProps} from '@sentry/scraps/input';

import {IconSearch, IconSettings} from 'sentry/icons';

import {updateInputGroupItemsWidth} from './inputGroup';

const interaction: SnapshotInteraction = {
  prepare: async page => {
    for (const items of await page.locator('[data-input-side]').all()) {
      await items.evaluate(updateInputGroupItemsWidth);
    }
    await page.locator('[data-input-group]').evaluateAll(groups => {
      const bodyStyle = getComputedStyle(document.body);
      if (!['light', 'dark'].includes(bodyStyle.colorScheme)) {
        throw new Error('Snapshot body has no theme color scheme');
      }
      for (const group of groups) {
        const input = group.querySelector<HTMLInputElement>('input, textarea');
        if (!input) {
          throw new Error('Input group has no input');
        }
        const bounds = input.getBoundingClientRect();
        const style = getComputedStyle(input);
        const leading = group.querySelector<HTMLElement>('[data-input-side="leading"]');
        const trailing = group.querySelector<HTMLElement>('[data-input-side="trailing"]');
        const gap = input.dataset.inputSize === 'xs' ? 2 : 4;
        const iconSize = {md: 16, sm: 14, xs: 12}[
          input.dataset.inputSize as 'md' | 'sm' | 'xs'
        ];
        for (const icon of group.querySelectorAll<SVGSVGElement>(
          '[data-input-side] > svg'
        )) {
          const expected = Number(icon.dataset.expectedSize ?? iconSize);
          const iconBounds = icon.getBoundingClientRect();
          if (iconBounds.width !== expected || iconBounds.height !== expected) {
            throw new Error(
              `Input icon is ${iconBounds.width}px, expected ${expected}px`
            );
          }
          if (!input.disabled && getComputedStyle(icon).fill !== bodyStyle.color) {
            throw new Error('Input icon does not inherit the snapshot theme text color');
          }
        }
        const textLeft =
          bounds.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
        const textRight =
          bounds.right -
          parseFloat(style.borderRightWidth) -
          parseFloat(style.paddingRight);
        if (
          leading &&
          Math.abs(textLeft - leading.getBoundingClientRect().right - gap) > 1
        ) {
          throw new Error('Input text overlaps leading items or has an incorrect gap');
        }
        if (
          trailing &&
          Math.abs(trailing.getBoundingClientRect().left - textRight - gap) > 1
        ) {
          throw new Error('Input text overlaps trailing items or has an incorrect gap');
        }
        const chipText = leading?.querySelector('[data-chip] span');
        if (
          chipText &&
          Math.abs(chipText.getBoundingClientRect().left - bounds.left - 17) > 0.1
        ) {
          throw new Error('Chip text does not align with plain input text');
        }
      }
    });
  },
};

describe('InputGroup', () => {
  it.snapshot.each(['transparent', 'secondary'] as const)(
    'with-%s-buttons',
    variant => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems>
            <Button
              variant={variant}
              size="zero"
              icon={<IconSearch />}
              aria-label="Search"
            />
          </InputGroup.LeadingItems>
          <InputGroup.Input placeholder="Search…" />
          <InputGroup.TrailingItems>
            <Button
              variant={variant}
              size="zero"
              icon={<IconSettings />}
              aria-label="Settings"
            />
          </InputGroup.TrailingItems>
        </InputGroup>
      </div>
    ),
    () => ({interaction})
  );

  it.snapshot.each<InputProps['size']>(['md', 'sm', 'xs'])(
    'size-%s',
    size => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.Input size={size} placeholder={`size ${size}`} />
        </InputGroup>
      </div>
    ),
    size => ({interaction, tags: {size: String(size), area: 'core'}})
  );

  it.snapshot(
    'disabled',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.Input disabled placeholder="Disabled input" />
        </InputGroup>
      </div>
    ),
    {interaction, tags: {disabled: 'true', area: 'core'}}
  );

  it.snapshot(
    'with-leading-items',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.LeadingItems>
          <InputGroup.Input placeholder="Search…" />
        </InputGroup>
      </div>
    ),
    {interaction, tags: {area: 'core'}}
  );

  it.snapshot(
    'with-leading-items-disabled',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.LeadingItems>
          <InputGroup.Input disabled placeholder="Search…" />
        </InputGroup>
      </div>
    ),
    {interaction, tags: {disabled: 'true', area: 'core'}}
  );

  it.snapshot.each<InputProps['size']>(['md', 'sm', 'xs'])(
    'with-trailing-items-size-%s',
    size => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSettings />
          </InputGroup.LeadingItems>
          <InputGroup.Input size={size} placeholder="Search…" />
          <InputGroup.TrailingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.TrailingItems>
        </InputGroup>
      </div>
    ),
    size => ({interaction, tags: {size: String(size), area: 'core'}})
  );

  it.snapshot(
    'with-explicit-icon-size',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch size="lg" data-expected-size="24" />
          </InputGroup.LeadingItems>
          <InputGroup.Input size="xs" />
          <InputGroup.TrailingItems>
            <Button size="sm" icon={<IconSettings />} aria-label="Settings" />
          </InputGroup.TrailingItems>
        </InputGroup>
      </div>
    ),
    {
      interaction: {
        prepare: async page => {
          await interaction.prepare?.(page);
          const icon = page.getByRole('button', {name: 'Settings'}).locator('svg');
          const bounds = await icon.boundingBox();
          expect(bounds?.width).toBe(14);
          expect(bounds?.height).toBe(14);
        },
      },
    }
  );

  it.snapshot(
    'with-leading-and-trailing-items',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.LeadingItems>
          <InputGroup.Input />
          <InputGroup.TrailingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.TrailingItems>
        </InputGroup>
      </div>
    ),
    {interaction}
  );

  it.snapshot(
    'textarea-with-leading-and-trailing-items',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.LeadingItems>
          <InputGroup.TextArea />
          <InputGroup.TrailingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.TrailingItems>
        </InputGroup>
      </div>
    ),
    {interaction}
  );

  it.snapshot(
    'with-leading-chip',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems>
            <Chip value="Chrome" />
          </InputGroup.LeadingItems>
          <InputGroup.Input />
        </InputGroup>
      </div>
    ),
    {interaction}
  );
});
