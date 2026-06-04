import {
  ToolbarFooter,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {
  ToolbarGroupByAddGroupBy,
  ToolbarGroupByDropdown,
  ToolbarGroupByHeader,
} from 'sentry/views/explore/components/toolbar/toolbarGroupBy';

export function ErrorsToolbarGroupBy() {
  return (
    <ToolbarSection data-test-id="section-group-by">
      <ToolbarGroupByHeader />
      <ToolbarGroupByItem />
      <ToolbarFooter>
        <ToolbarGroupByAddGroupBy add={() => {}} disabled={false} />
      </ToolbarFooter>
    </ToolbarSection>
  );
}

function ToolbarGroupByItem() {
  return (
    <ToolbarGroupByDropdown
      column={{column: '', id: 0, uniqueId: '0'}}
      options={[{label: '-', value: '', textValue: '-'}]}
      loading={false}
      onClose={() => {}}
      onSearch={() => {}}
      canDelete={false}
      onColumnChange={() => {}}
      onColumnDelete={() => {}}
    />
  );
}
