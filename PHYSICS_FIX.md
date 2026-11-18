# Wind Studio 3D — Physics Fix

The cloth/hair Verlet constraint solver was over-correcting constraint
positions by a factor of 2. This could make the dress and hair stretch into
large spikes when wind was applied.

The fix removes that extra factor and keeps the original project structure,
UI, microphone engine, and scene setup unchanged.
