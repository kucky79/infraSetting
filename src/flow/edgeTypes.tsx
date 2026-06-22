import type { MouseEvent, PointerEvent } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "reactflow";

export function SelectableSmoothStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
    offset: 24,
  });

  const handleSelect = (event: MouseEvent | PointerEvent) => {
    if ("button" in event && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent("infra-edge-select", { detail: { edgeId: id } }));
  };

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("infra-edge-context-menu", {
        detail: { edgeId: id, x: event.clientX, y: event.clientY },
      }),
    );
    window.dispatchEvent(new CustomEvent("infra-edge-select", { detail: { edgeId: id } }));
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={28}
      />
      <path
        className="customEdgeInteraction"
        data-edge-id={id}
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={28}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        onPointerDown={handleSelect}
      />
      {label ? (
        <EdgeLabelRenderer>
          <button
            className="edgeLabelButton"
            data-edge-id={id}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            type="button"
            onClick={handleSelect}
            onContextMenu={handleContextMenu}
            onPointerDown={handleSelect}
          >
            {label}
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const edgeTypes = {
  selectableSmoothstep: SelectableSmoothStepEdge,
};
