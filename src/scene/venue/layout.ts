/**
 * Ticketing venue layout for the Sawarga Courtyard playground.
 *
 * Pure data + math only (no Three.js) so it can later be copied into the
 * ticketing project. It mirrors the original ticketing system's world and
 * seat layout, with the TRIB seats re-laid on the curved shell-attached
 * balconies.
 *
 * Source of truth for the original dimensions:
 *   ticketing-system/src/components/scene/summaba/layout.ts
 *   ticketing-system/src/lib/seatLayout.ts
 */

export type Vec3 = { x: number; y: number; z: number }
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }
export type SeatCategory = 'VIP' | 'CAT1' | 'TRIB' | 'REG'
export type BalconySide = 'L' | 'R'

export interface VenueSeat {
  id: string
  categoryKey: SeatCategory
  section: string
  row: string
  num: number
  x: number
  y: number
  z: number
  /** TRIB seats face the stage; floor seats are axis-aligned toward -Z. */
  rotationY: number
}

/** The original ticketing project's authoritative world contract. */
export const VENUE_WORLD = {
  bounds: { minX: -48, maxX: 48, minZ: -40, maxZ: 40 },
  courtyard: { minX: -22, maxX: 22, minZ: -18, maxZ: 23 },
  stage: { x: 0, z: -13, width: 24, depth: 9 },
  stageObstacle: { minX: -15, maxX: 15, minZ: -18, maxZ: -8.5 },
  balcony: { y: 5.2, innerX: 14, outerX: 20, minZ: -14, maxZ: 15 },
  stairs: {
    east: { minX: 18, maxX: 21, minZ: 14, maxZ: 20 },
    west: { minX: -21, maxX: -18, minZ: 14, maxZ: 20 },
  },
  southEdge: {
    board: { x: -9, z: 22, rotationY: 2.72, halfWidth: 2.8, halfDepth: 0.3 },
    booth: { x: 9, z: 22, rotationY: -2.72, halfWidth: 1.8, halfDepth: 0.9 },
  },
  spawn: { x: 0, z: 19 },
  /** Not rebuilt in the playground yet; kept for the later migration. */
  atriums: {
    ciunik: { minX: -15, maxX: 15, minZ: -34, maxZ: -18 },
    cibadak: { minX: 22, maxX: 36, minZ: -15, maxZ: 15 },
    cileutik: { minX: -36, maxX: -22, minZ: -15, maxZ: 15 },
  },
  downtown: { minX: -40, maxX: 40, minZ: 20, maxZ: 40 },
  koiPond: { x: -12, z: 31, rx: 7, rz: 4 },
  liveMusic: { x: 16, z: 27 },
  lobbyCaang: { x: 26, z: 22 },
} as const

/** The Sawarga shell ellipse used by the playground facades. */
export const SHELL = { radiusX: 35, radiusZ: 25 } as const

/** Curved shell-attached balcony parameters. */
export const BALCONY = {
  depth: 6,
  /** Angles are in units of PI. East = [-0.16, 0.16]; west = [0.84, 1.16]. */
  eastAngleRange: [-0.16, 0.16] as const,
  westAngleRange: [0.84, 1.16] as const,
  rowOffsets: [5, 3, 1] as const,
  rowY: [5.2, 5.75, 6.3] as const,
  seatsPerRow: 20,
  seatZMin: -10.5,
  seatZMax: 11.35,
  /** Atria glass drums in the Sawarga shell. */
  atria: {
    ciunik: { angle: 0.75, radius: 6.4, offset: 3.6 },
    cibadak: { angle: 0.25, radius: 6.4, offset: 3.6 },
    cileutik: { angle: 1.75, radius: 6.4, offset: 3.6 },
  },
} as const

export const TOTAL_TRIB_SEATS = BALCONY.seatsPerRow * BALCONY.rowY.length * 2

export function shellPoint(angle: number): { x: number; z: number } {
  return {
    x: Math.cos(angle) * SHELL.radiusX,
    z: Math.sin(angle) * SHELL.radiusZ,
  }
}

/** Unit normal pointing inward from the shell. */
export function shellInwardNormal(angle: number): { x: number; z: number } {
  const nx = Math.cos(angle) / SHELL.radiusX
  const nz = Math.sin(angle) / SHELL.radiusZ
  const length = Math.hypot(nx, nz) || 1
  return { x: -nx / length, z: -nz / length }
}

export function shellOffsetPoint(angle: number, inwardOffset: number): { x: number; z: number } {
  const point = shellPoint(angle)
  const normal = shellInwardNormal(angle)
  return {
    x: point.x + normal.x * inwardOffset,
    z: point.z + normal.z * inwardOffset,
  }
}

/** Angle on the requested side for a given z within the seat band. */
export function sideAngleForZ(side: BalconySide, z: number): number {
  const t = Math.asin(Math.max(-1, Math.min(1, z / SHELL.radiusZ)))
  return side === 'R' ? t : Math.PI - t
}

/** Seat rows: row A = inner/lowest, row C = outer/highest. */
export function buildTribSeats(): VenueSeat[] {
  const seats: VenueSeat[] = []
  const stageX = VENUE_WORLD.stage.x
  const stageZ = VENUE_WORLD.stage.z

  for (const side of ['L', 'R'] as const) {
    const section = `TRIB${side}`
    const rows = ['A', 'B', 'C'] as const
    for (let r = 0; r < rows.length; r += 1) {
      for (let i = 0; i < BALCONY.seatsPerRow; i += 1) {
        const z = BALCONY.seatZMin +
          (i / Math.max(1, BALCONY.seatsPerRow - 1)) * (BALCONY.seatZMax - BALCONY.seatZMin)
        const angle = sideAngleForZ(side, z)
        const point = shellOffsetPoint(angle, BALCONY.rowOffsets[r])
        const x = point.x
        const zz = point.z
        const rotationY = Math.atan2(x - stageX, zz - stageZ)
        seats.push({
          id: `${section}-${rows[r]}${i + 1}`,
          categoryKey: 'TRIB',
          section,
          row: rows[r],
          num: i + 1,
          x,
          y: BALCONY.rowY[r],
          z: zz,
          rotationY,
        })
      }
    }
  }
  return seats
}

/**
 * Mirrors the original ticketing seat generator. VIP/CAT1/REG keep their
 * original coordinates; TRIB uses the curved shell balconies.
 */
export function buildVenueSeats(): VenueSeat[] {
  const seats: VenueSeat[] = []

  // VIP: rows A-D, 12 per row, closest to the stage (stage front at z -8.5).
  const vipRows = ['A', 'B', 'C', 'D']
  vipRows.forEach((row, r) => {
    for (let i = 0; i < 12; i += 1) {
      seats.push({
        id: `VIP-${row}${i + 1}`,
        categoryKey: 'VIP',
        section: 'VIP',
        row,
        num: i + 1,
        x: (i - 5.5) * 1.3,
        y: 0,
        z: -7.3 + r * 1.6,
        rotationY: 0,
      })
    }
  })

  // CAT1: rows E-L, 16 per row.
  const cat1Rows = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  cat1Rows.forEach((row, r) => {
    for (let i = 0; i < 16; i += 1) {
      seats.push({
        id: `CAT1-${row}${i + 1}`,
        categoryKey: 'CAT1',
        section: 'CAT1',
        row,
        num: i + 1,
        x: (i - 7.5) * 1.25,
        y: 0,
        z: -0.9 + r * 1.6,
        rotationY: 0,
      })
    }
  })

  // REG: rows M-Q, 30 per row, rear garden lawn.
  const regRows = ['M', 'N', 'O', 'P', 'Q']
  regRows.forEach((row, r) => {
    for (let i = 0; i < 30; i += 1) {
      seats.push({
        id: `REG-${row}${i + 1}`,
        categoryKey: 'REG',
        section: 'REG',
        row,
        num: i + 1,
        x: (i - 14.5) * 1.1,
        y: 0,
        z: 11.3 + r * 1.6,
        rotationY: 0,
      })
    }
  })

  seats.push(...buildTribSeats())
  return seats
}

export const VENUE_SEATS = buildVenueSeats()
export const VENUE_SEAT_COUNT = VENUE_SEATS.length

export const CATEGORY_COLORS: Record<SeatCategory, number> = {
  VIP: 0xf5c542,
  CAT1: 0x9b7bff,
  TRIB: 0x38bdf8,
  REG: 0x2dd4bf,
}

/** Footprint helpers used by the layout overlay and clearance checks. */
export function rotatedFootprint(
  x: number,
  z: number,
  halfWidth: number,
  halfDepth: number,
  rotationY: number,
): Rect {
  const c = Math.abs(Math.cos(rotationY))
  const s = Math.abs(Math.sin(rotationY))
  const halfX = halfWidth * c + halfDepth * s
  const halfZ = halfWidth * s + halfDepth * c
  return { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ }
}

export const BOARD_FOOTPRINT = rotatedFootprint(
  VENUE_WORLD.southEdge.board.x,
  VENUE_WORLD.southEdge.board.z,
  VENUE_WORLD.southEdge.board.halfWidth,
  VENUE_WORLD.southEdge.board.halfDepth,
  VENUE_WORLD.southEdge.board.rotationY,
)

export const BOOTH_FOOTPRINT = rotatedFootprint(
  VENUE_WORLD.southEdge.booth.x,
  VENUE_WORLD.southEdge.booth.z,
  VENUE_WORLD.southEdge.booth.halfWidth,
  VENUE_WORLD.southEdge.booth.halfDepth,
  VENUE_WORLD.southEdge.booth.rotationY,
)
