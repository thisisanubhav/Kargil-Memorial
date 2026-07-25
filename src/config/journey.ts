/**
 * The visitor journey: a trail from the spawn to the memorial stairs,
 * with the honoured stones spaced along it. Distances in metres.
 */
export interface JourneyConfig {
  /** Trail polyline (X, Z), from the visitor's start toward the stairs. */
  readonly waypoints: readonly (readonly [number, number])[];
  /** Trail length reserved before the first stone. */
  readonly startMargin: number;
  /** Trail length reserved after the last stone. */
  readonly endMargin: number;
  /** How far stones stand from the trail line, alternating sides. */
  readonly sideOffset: number;
  /** Farthest distance at which a looked-at stone shows its card. */
  readonly maxDistance: number;
  /** Distance beyond which an active card always releases. */
  readonly releaseDistance: number;
  /** Standing this close shows the card regardless of gaze. */
  readonly nearRadius: number;
  /** Gaze cone (degrees off-centre) that counts as focusing a stone. */
  readonly focusDegrees: number;
  /** Wider cone the gaze must leave before an active card fades. */
  readonly releaseDegrees: number;
}

// An avenue of honour: a slope-verified line across the eastern basin
// from the spawn to the base of the great stair. The visitor walks
// between the stones, meets each hero in turn, then begins the ascent.
export const journeyConfig: JourneyConfig = {
  // The first stone stands inside the opening view, then the line curves
  // east to the stair base — slope-verified across its whole length.
  waypoints: [
    [1.5, 11],
    [6, 11.5],
    [12.5, 11],
    [16.3, 8.8],
  ],
  startMargin: 1.5,
  endMargin: 2,
  sideOffset: 1.6,
  maxDistance: 6.5,
  releaseDistance: 7.5,
  nearRadius: 2.2,
  focusDegrees: 24,
  releaseDegrees: 38,
};
