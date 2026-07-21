"""
Готовим модель: заднюю крышку и заднее кольцо режем на поперечные диски
(чтобы задняя часть красиво распадалась), остальное не трогаем.
Запуск: blender --background --python process_final.py -- <in.glb> <out.glb>
"""
import bpy, bmesh, sys
from mathutils import Vector
argv=sys.argv[sys.argv.index("--")+1:]
INP,OUT=argv[0],argv[1]
def log(*a): print("[fin]",*a)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=INP)
sc=bpy.context.scene
# отвязываем от родителей (мировые координаты)
for o in sc.objects: o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in sc.objects if o.type=='MESH')
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

# главная ось
gmn=Vector((1e9,)*3); gmx=Vector((-1e9,)*3)
for o in [o for o in sc.objects if o.type=='MESH']:
    for c in o.bound_box:
        w=o.matrix_world@Vector(c)
        for k in range(3): gmn[k]=min(gmn[k],w[k]); gmx[k]=max(gmx[k],w[k])
axis=max(range(3),key=lambda i:(gmx-gmn)[i])
axv=[0,0,0]; axv[axis]=1; axv=Vector(axv)
log("ось =", "XYZ"[axis])

def slice_obj(name, K):
    o=next((x for x in sc.objects if x.type=='MESH' and name in x.name),None)
    if not o: log("нет:",name); return
    for x in sc.objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    co=[v.co[axis] for v in o.data.vertices]
    lo,hi=min(co),max(co); span=hi-lo
    base=o.data
    for i in range(K):
        zl=lo+span*i/K - 1e-4; zh=lo+span*(i+1)/K + 1e-4
        dup=o.copy(); dup.data=base.copy(); sc.collection.objects.link(dup)
        bm=bmesh.new(); bm.from_mesh(dup.data)
        pc=[0,0,0]; pc[axis]=zl
        bmesh.ops.bisect_plane(bm,geom=bm.verts[:]+bm.edges[:]+bm.faces[:],
                               plane_co=pc,plane_no=axv,clear_inner=True)
        pc=[0,0,0]; pc[axis]=zh
        bmesh.ops.bisect_plane(bm,geom=bm.verts[:]+bm.edges[:]+bm.faces[:],
                               plane_co=pc,plane_no=axv,clear_outer=True)
        bm.to_mesh(dup.data); bm.free(); dup.name=f"{name}_slice_{i}"
        if len(dup.data.vertices)==0: bpy.data.objects.remove(dup,do_unlink=True)
    bpy.data.objects.remove(o,do_unlink=True)
    log(f"нарезал {name!r} на {K}")

slice_obj("Line007", 5)              # основной корпус
slice_obj("Line002_Material #343", 2)  # ТОЛЬКО чёрная передняя труба (не белая шкала!)
slice_obj("end cap", 2)              # задний байонет — один разрез

for o in sc.objects: o.select_set(o.type=='MESH')
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=False,export_apply=True)
log("готово ->",OUT, "мешей:", len([o for o in sc.objects if o.type=='MESH']))
