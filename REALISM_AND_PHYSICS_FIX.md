# WIND STUDIO 3D — fixed simulation build

This version keeps the existing React + Three.js structure but fixes the main simulation problems in the original project:

- the character is more human-proportioned and has more detailed face/hair/limbs
- the outfit has a stable bodice + simulated skirt
- cloth stays still when wind is off
- cloth no longer receives idle upward force
- wind is mainly horizontal, with controlled lift only during stronger gusts
- cloth movement is capped and constraint correction is reduced to prevent polygon explosions
- hair also remains stable at zero wind
- stronger gusts progressively raise the character's arms as if holding the skirt
- the scene no longer passes the location's ambient wind floor into the character cloth

Important: this is still a procedural Three.js character, not a photorealistic scanned/rigged 3D human. A truly photorealistic character requires an external/licensed GLB/FBX character asset and textures.
