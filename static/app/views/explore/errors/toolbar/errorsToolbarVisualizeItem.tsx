import {ToolbarVisualizeDropdown} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {VisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

export function ErrorsToolbarVisualizeItem() {
  const sampleVisualize = new VisualizeFunction('count()', {visible: true});
  const label = (
    <VisualizeLabel index={0} visualize={sampleVisualize} onClick={() => {}} />
  );
  return (
    <ToolbarVisualizeDropdown
      aggregateOptions={[{label: 'Count', value: 'count', textValue: 'count'}]}
      fieldOptions={[]}
      onChangeAggregate={() => {}}
      onChangeArgument={() => {}}
      parsedFunction={sampleVisualize.parsedFunction}
      label={label}
      loading={false}
      onSearch={() => {}}
      onClose={() => {}}
    />
  );
}
