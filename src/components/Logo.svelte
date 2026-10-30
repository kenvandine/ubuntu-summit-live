<script lang="ts">
  let { size = 32 }: { size?: number } = $props()
</script>

<img src={`${import.meta.env.BASE_URL}icons/icon.svg`} width={size} height={size} alt="" />
