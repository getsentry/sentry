import {ToolbarGroupBy} from './toolbarGroupBy';
import {ToolbarLimitTo} from './toolbarLimitTo';
import {ToolbarResults} from './toolbarResults';
import {ToolbarSortBy} from './toolbarSortBy';
import {ToolbarVisualize} from './toolbarVisualize';

interface ExploreToolbarProps {}

export function ExploreToolbar({}: ExploreToolbarProps) {
  return (
    <div>
      <ToolbarResults />
      <ToolbarVisualize />
      <ToolbarSortBy />
      <ToolbarLimitTo />
      <ToolbarGroupBy disabled />
    </div>
  );
}
